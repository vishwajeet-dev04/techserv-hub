"""Automated payable due-date reminder emails for Finance and Admin users."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal

from django.conf import settings
from django.core.mail import send_mail
from django.db import IntegrityError, transaction

from apps.finance.models import Payable, PayableReminderEmailLog, PayableStatus
from apps.users.models import User, UserRole

logger = logging.getLogger(__name__)

REMINDER_OFFSETS = (3, 1)
RECIPIENT_ROLES = (UserRole.FINANCE, UserRole.ADMIN)


@dataclass(frozen=True)
class PayableReminderResult:
    sent: int = 0
    skipped: int = 0
    failed: int = 0


def reminder_recipients() -> list[str]:
    emails = (
        User.objects.filter(is_active=True, role__in=RECIPIENT_ROLES)
        .exclude(email='')
        .order_by('email')
        .values_list('email', flat=True)
    )
    return list(dict.fromkeys(email.strip() for email in emails if email and email.strip()))


def _format_date(value: date | None) -> str:
    return value.strftime('%d/%m/%Y') if value else '—'


def _format_inr(value: Decimal) -> str:
    whole, _, paise = f'{Decimal(value or 0):.2f}'.partition('.')
    sign = '-' if whole.startswith('-') else ''
    digits = whole.lstrip('-')
    if len(digits) > 3:
        head, tail = digits[:-3], digits[-3:]
        groups = []
        while len(head) > 2:
            groups.insert(0, head[-2:])
            head = head[:-2]
        if head:
            groups.insert(0, head)
        digits = ','.join(groups + [tail])
    return f'{sign}Rs. {digits}.{paise}'


def _payables_link() -> str:
    base = (getattr(settings, 'FRONTEND_URL', '') or '').rstrip('/')
    return f'{base}/finance/payables?status=pending' if base else ''


def build_payable_reminder_email(payables: list[Payable], *, offset_days: int, due_date: date) -> tuple[str, str]:
    when = 'tomorrow' if offset_days == 1 else f'in {offset_days} days'
    total = sum((row.payable_amount for row in payables), Decimal('0'))
    count = len(payables)
    subject = f'Payables reminder: {count} bill{"s" if count != 1 else ""} due {when} ({_format_date(due_date)})'
    lines = [
        'Hi Finance team,',
        '',
        f'The following vendor bill{"s are" if count != 1 else " is"} due {when}, on {_format_date(due_date)}:',
        '',
    ]
    for row in payables:
        lines.extend([
            f'- {row.vendor} · Invoice {row.invoice_number or "—"}',
            f'  Invoice date: {_format_date(row.invoice_date)} · Due date: {_format_date(row.due_date)}',
            f'  Payable: {_format_inr(row.payable_amount)}',
        ])
    lines.extend(['', f'Total due: {_format_inr(total)}', ''])
    link = _payables_link()
    if link:
        lines.extend([f'Open Payables: {link}', ''])
    lines.append('— TechServ Hub')
    return subject, '\n'.join(lines)


def _pending_unreminded(*, offset_days: int, due_date: date) -> list[Payable]:
    already = PayableReminderEmailLog.objects.filter(offset_days=offset_days, due_date=due_date).values('payable_id')
    return list(
        Payable.objects.filter(status__in=[PayableStatus.DUE, PayableStatus.OVERDUE], due_date=due_date)
        .exclude(id__in=already)
        .order_by('vendor', 'invoice_number')
    )


def send_payable_due_reminders(*, as_of_date: date | None = None) -> PayableReminderResult:
    """Email Finance/Admin users about pending payables due 3 days and 1 day after `as_of_date` (default today)."""
    today = as_of_date or date.today()
    recipients = reminder_recipients()
    sent = skipped = failed = 0
    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', None) or 'noreply@techserv.local'

    for offset_days in REMINDER_OFFSETS:
        due_date = today + timedelta(days=offset_days)
        payables = _pending_unreminded(offset_days=offset_days, due_date=due_date)
        if not payables:
            continue
        if not recipients:
            skipped += len(payables)
            logger.warning('Payable reminders skipped: no active Finance/Admin users with email.')
            continue
        subject, body = build_payable_reminder_email(payables, offset_days=offset_days, due_date=due_date)
        try:
            send_mail(subject, body, from_email, recipients, fail_silently=False)
        except Exception:
            logger.exception('Failed payable reminder email offset=%s due=%s count=%s', offset_days, due_date, len(payables))
            failed += len(payables)
            continue
        joined = ', '.join(recipients)
        for payable in payables:
            try:
                with transaction.atomic():
                    PayableReminderEmailLog.objects.create(
                        payable=payable,
                        offset_days=offset_days,
                        due_date=due_date,
                        recipients=joined,
                    )
            except IntegrityError:
                skipped += 1
                continue
            sent += 1

    logger.info(
        'Payable due reminders as_of=%s sent=%s skipped=%s failed=%s',
        today.isoformat(),
        sent,
        skipped,
        failed,
    )
    return PayableReminderResult(sent=sent, skipped=skipped, failed=failed)
