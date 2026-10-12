"""Automated receivable due-date reminder emails for Finance and Admin users."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal

from django.conf import settings
from django.core.mail import send_mail
from django.db import IntegrityError, transaction

from apps.finance.models import Invoice, InvoiceReminderEmailLog, InvoiceStatus
from apps.finance.payable_reminders import reminder_recipients

logger = logging.getLogger(__name__)

REMINDER_OFFSETS = (3, 1)
UNPAID_STATUSES = (
    InvoiceStatus.DUE,
    InvoiceStatus.OVERDUE,
)


@dataclass(frozen=True)
class InvoiceReminderResult:
    sent: int = 0
    skipped: int = 0
    failed: int = 0


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


def _invoices_link() -> str:
    base = (getattr(settings, 'FRONTEND_URL', '') or '').rstrip('/')
    return f'{base}/finance/invoices?status=outstanding' if base else ''


def build_invoice_reminder_email(invoices: list[Invoice], *, offset_days: int, due_date: date) -> tuple[str, str]:
    when = 'tomorrow' if offset_days == 1 else f'in {offset_days} days'
    total = sum((row.balance for row in invoices), Decimal('0'))
    count = len(invoices)
    subject = f'Receivables reminder: {count} invoice{"s" if count != 1 else ""} due {when} ({_format_date(due_date)})'
    lines = [
        'Hi Finance team,',
        '',
        f'The following receivable{"s are" if count != 1 else " is"} due {when}, on {_format_date(due_date)}:',
        '',
    ]
    for row in invoices:
        lines.extend([
            f'- {row.customer_name} · Invoice {row.invoice_number or "—"}',
            f'  Invoice date: {_format_date(row.invoice_date)} · Due date: {_format_date(row.due_date)}',
            f'  Balance: {_format_inr(row.balance)}',
        ])
    lines.extend(['', f'Total outstanding: {_format_inr(total)}', ''])
    link = _invoices_link()
    if link:
        lines.extend([f'Open Receivables: {link}', ''])
    lines.append('— TechServ Hub')
    return subject, '\n'.join(lines)


def _unpaid_unreminded(*, offset_days: int, due_date: date) -> list[Invoice]:
    already = InvoiceReminderEmailLog.objects.filter(offset_days=offset_days, due_date=due_date).values('invoice_id')
    return list(
        Invoice.objects.filter(status__in=UNPAID_STATUSES, due_date=due_date)
        .exclude(id__in=already)
        .order_by('customer_name', 'invoice_number')
    )


def send_invoice_due_reminders(*, as_of_date: date | None = None) -> InvoiceReminderResult:
    """Email Finance/Admin about unpaid invoices due 3 days and 1 day after `as_of_date` (default today)."""
    today = as_of_date or date.today()
    recipients = reminder_recipients()
    sent = skipped = failed = 0
    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', None) or 'noreply@techserv.local'

    for offset_days in REMINDER_OFFSETS:
        due_date = today + timedelta(days=offset_days)
        invoices = _unpaid_unreminded(offset_days=offset_days, due_date=due_date)
        if not invoices:
            continue
        if not recipients:
            skipped += len(invoices)
            logger.warning('Receivable reminders skipped: no active Finance/Admin users with email.')
            continue
        subject, body = build_invoice_reminder_email(invoices, offset_days=offset_days, due_date=due_date)
        try:
            send_mail(subject, body, from_email, recipients, fail_silently=False)
        except Exception:
            logger.exception(
                'Failed receivable reminder email offset=%s due=%s count=%s',
                offset_days,
                due_date,
                len(invoices),
            )
            failed += len(invoices)
            continue
        joined = ', '.join(recipients)
        for invoice in invoices:
            try:
                with transaction.atomic():
                    InvoiceReminderEmailLog.objects.create(
                        invoice=invoice,
                        offset_days=offset_days,
                        due_date=due_date,
                        recipients=joined,
                    )
            except IntegrityError:
                skipped += 1
                continue
            sent += 1

    logger.info(
        'Receivable due reminders as_of=%s sent=%s skipped=%s failed=%s',
        today.isoformat(),
        sent,
        skipped,
        failed,
    )
    return InvoiceReminderResult(sent=sent, skipped=skipped, failed=failed)
