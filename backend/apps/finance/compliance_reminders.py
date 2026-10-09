"""Automated compliance due-date reminder emails for Finance and Admin users."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date, timedelta

from django.conf import settings
from django.core.mail import send_mail
from django.db import IntegrityError, transaction

from apps.finance.models import ComplianceItem, ComplianceReminderEmailLog, ComplianceStatus
from apps.finance.payable_reminders import reminder_recipients
from apps.users.models import User

logger = logging.getLogger(__name__)

REMINDER_OFFSETS = (3, 1)


@dataclass(frozen=True)
class ComplianceReminderResult:
    sent: int = 0
    skipped: int = 0
    failed: int = 0


def _format_date(value: date | None) -> str:
    return value.strftime('%d/%m/%Y') if value else '—'


def _compliance_link() -> str:
    base = (getattr(settings, 'FRONTEND_URL', '') or '').rstrip('/')
    return f'{base}/finance/compliance' if base else ''


def _recipient_users() -> list[User]:
    emails = reminder_recipients()
    if not emails:
        return []
    return list(User.objects.filter(is_active=True, email__in=emails).order_by('email'))


def build_compliance_reminder_email(
    items: list[ComplianceItem],
    *,
    recipient_name: str,
    offset_days: int,
    due_date: date,
) -> tuple[str, str]:
    when = 'tomorrow' if offset_days == 1 else f'in {offset_days} days'
    count = len(items)
    filing = 'filing' if count == 1 else 'filings'
    verb = 'is' if count == 1 else 'are'
    subject = f'Compliance reminder: {count} {filing} due {when} ({_format_date(due_date)})'
    lines = [
        f'Hi {recipient_name},',
        '',
        f'The following compliance {filing} {verb} due {when}, on {_format_date(due_date)}:',
        '',
    ]
    for row in items:
        period = row.period_month.strftime('%B %Y') if row.period_month else '—'
        lines.extend([
            f'- {row.title}',
            f'  Form: {row.form_name or "—"} · Act: {row.applicable_act or "—"}',
            f'  Period: {period} · Due: {_format_date(row.due_date)}',
        ])
    lines.append('')
    link = _compliance_link()
    if link:
        lines.extend([f'Open Compliance Calendar: {link}', ''])
    lines.append('— TechServ Hub')
    return subject, '\n'.join(lines)


def _pending_for_recipient(*, offset_days: int, due_date: date, recipient_email: str) -> list[ComplianceItem]:
    already = ComplianceReminderEmailLog.objects.filter(
        offset_days=offset_days,
        due_date=due_date,
        recipient_email=recipient_email,
    ).values('compliance_item_id')
    return list(
        ComplianceItem.objects.filter(status=ComplianceStatus.PENDING, due_date=due_date)
        .exclude(id__in=already)
        .order_by('applicable_act', 'title')
    )


def send_compliance_due_reminders(*, as_of_date: date | None = None) -> ComplianceReminderResult:
    """Email each Finance/Admin user about pending filings due 3 days and 1 day after `as_of_date`."""
    today = as_of_date or date.today()
    recipients = _recipient_users()
    sent = skipped = failed = 0
    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', None) or 'noreply@techserv.local'

    for offset_days in REMINDER_OFFSETS:
        due_date = today + timedelta(days=offset_days)
        pending_exists = ComplianceItem.objects.filter(
            status=ComplianceStatus.PENDING,
            due_date=due_date,
        ).exists()
        if not pending_exists:
            continue
        if not recipients:
            skipped += ComplianceItem.objects.filter(
                status=ComplianceStatus.PENDING,
                due_date=due_date,
            ).count()
            logger.warning('Compliance reminders skipped: no active Finance/Admin users with email.')
            continue
        for user in recipients:
            items = _pending_for_recipient(
                offset_days=offset_days,
                due_date=due_date,
                recipient_email=user.email,
            )
            if not items:
                continue
            subject, body = build_compliance_reminder_email(
                items,
                recipient_name=user.name,
                offset_days=offset_days,
                due_date=due_date,
            )
            try:
                send_mail(subject, body, from_email, [user.email], fail_silently=False)
            except Exception:
                logger.exception(
                    'Failed compliance reminder email offset=%s due=%s to=%s count=%s',
                    offset_days,
                    due_date,
                    user.email,
                    len(items),
                )
                failed += 1
                continue
            for item in items:
                try:
                    with transaction.atomic():
                        ComplianceReminderEmailLog.objects.create(
                            compliance_item=item,
                            offset_days=offset_days,
                            due_date=due_date,
                            recipient_email=user.email,
                        )
                except IntegrityError:
                    skipped += 1
            sent += 1

    logger.info(
        'Compliance due reminders as_of=%s sent=%s skipped=%s failed=%s',
        today.isoformat(),
        sent,
        skipped,
        failed,
    )
    return ComplianceReminderResult(sent=sent, skipped=skipped, failed=failed)
