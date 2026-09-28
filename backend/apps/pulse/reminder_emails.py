"""Automated follow-up and expected-close-date reminder emails for opportunity assignees."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date, timedelta

from django.conf import settings
from django.core.mail import send_mail
from django.db import IntegrityError
from django.db.models import Q

from apps.pulse.constants import CLOSED_OUT_STAGES
from apps.pulse.models import (
    Opportunity,
    OpportunityReminderEmailKind,
    OpportunityReminderEmailLog,
    OpportunityStatus,
)

logger = logging.getLogger(__name__)

REMINDER_OFFSETS = (3, 1)


@dataclass(frozen=True)
class ReminderSendResult:
    sent: int = 0
    skipped: int = 0
    failed: int = 0


def _frontend_opportunity_url(opportunity_id) -> str:
    base = (getattr(settings, 'FRONTEND_URL', '') or '').rstrip('/')
    if not base:
        return ''
    return f'{base}/pulse/opportunities'


def _format_date(value: date) -> str:
    return value.strftime('%d/%m/%Y')


def build_reminder_email(
    *,
    opportunity: Opportunity,
    reminder_kind: str,
    offset_days: int,
    target_date: date,
) -> tuple[str, str]:
    kind_label = 'follow-up' if reminder_kind == OpportunityReminderEmailKind.FOLLOW_UP else 'expected close'
    company = getattr(opportunity.company, 'name', '') or '—'
    prospect = opportunity.prospect_number or '—'
    when = 'tomorrow' if offset_days == 1 else f'in {offset_days} days'
    subject = (
        f'Pulse reminder: {kind_label} {when} — {prospect}'
    )
    link = _frontend_opportunity_url(opportunity.id)
    lines = [
        f'Hi {opportunity.owner.name if opportunity.owner else "there"},',
        '',
        f'This is a reminder that the {kind_label} date for an opportunity is {when}.',
        '',
        f'Prospect: {prospect}',
        f'Name: {opportunity.name}',
        f'Company: {company}',
        f'Stage: {opportunity.stage}',
        f'{kind_label.title()} date: {_format_date(target_date)}',
        '',
    ]
    if link:
        lines.extend([f'Open Pulse: {link}', ''])
    lines.append('— TechServ Hub')
    return subject, '\n'.join(lines)


def _already_sent(opportunity_id, reminder_kind: str, offset_days: int, target_date: date) -> bool:
    return OpportunityReminderEmailLog.objects.filter(
        opportunity_id=opportunity_id,
        reminder_kind=reminder_kind,
        offset_days=offset_days,
        target_date=target_date,
    ).exists()


def _open_opportunities_for_date(*, field: str, target_date: date):
    return (
        Opportunity.objects.filter(
            status=OpportunityStatus.OPEN,
            **{field: target_date},
        )
        .exclude(stage__in=CLOSED_OUT_STAGES)
        .filter(owner__isnull=False)
        .exclude(Q(owner__email='') | Q(owner__email__isnull=True))
        .select_related('owner', 'company')
    )


def _send_one(
    opportunity: Opportunity,
    *,
    reminder_kind: str,
    offset_days: int,
    target_date: date,
) -> str:
    """Return 'sent' | 'skipped' | 'failed'."""
    if _already_sent(opportunity.id, reminder_kind, offset_days, target_date):
        return 'skipped'

    recipient = (opportunity.owner.email or '').strip()
    if not recipient:
        return 'skipped'

    subject, body = build_reminder_email(
        opportunity=opportunity,
        reminder_kind=reminder_kind,
        offset_days=offset_days,
        target_date=target_date,
    )
    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', None) or 'noreply@techserv.local'
    try:
        send_mail(
            subject,
            body,
            from_email,
            [recipient],
            fail_silently=False,
        )
    except Exception:
        logger.exception(
            'Failed reminder email opp=%s kind=%s offset=%s to=%s',
            opportunity.id,
            reminder_kind,
            offset_days,
            recipient,
        )
        return 'failed'

    try:
        OpportunityReminderEmailLog.objects.create(
            opportunity=opportunity,
            reminder_kind=reminder_kind,
            offset_days=offset_days,
            target_date=target_date,
            recipient_email=recipient,
        )
    except IntegrityError:
        return 'skipped'
    return 'sent'


def send_due_opportunity_date_reminders(*, as_of_date: date | None = None) -> ReminderSendResult:
    """
    Send assignee emails for follow_up_date and expected_close_date
    at 3 days before and 1 day before `as_of_date` (default: today).
    """
    today = as_of_date or date.today()
    result = ReminderSendResult()
    sent = skipped = failed = 0

    jobs = (
        (OpportunityReminderEmailKind.FOLLOW_UP, 'follow_up_date'),
        (OpportunityReminderEmailKind.CLOSE, 'expected_close_date'),
    )

    for reminder_kind, field in jobs:
        for offset_days in REMINDER_OFFSETS:
            target_date = today + timedelta(days=offset_days)
            for opportunity in _open_opportunities_for_date(field=field, target_date=target_date):
                status = _send_one(
                    opportunity,
                    reminder_kind=reminder_kind,
                    offset_days=offset_days,
                    target_date=target_date,
                )
                if status == 'sent':
                    sent += 1
                elif status == 'failed':
                    failed += 1
                else:
                    skipped += 1

    logger.info(
        'Opportunity date reminders as_of=%s sent=%s skipped=%s failed=%s',
        today.isoformat(),
        sent,
        skipped,
        failed,
    )
    return ReminderSendResult(sent=sent, skipped=skipped, failed=failed)
