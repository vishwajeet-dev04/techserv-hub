"""Receivable and payable status: automatic Due/Overdue and logged manual changes."""

from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.finance.models import (
    OPEN_STATUSES,
    FinanceStatusChange,
    Invoice,
    InvoiceStatus,
    Payable,
)


def refresh_auto_statuses(workspace: tuple[str, str] | None = None, today=None) -> int:
    """Move open rows that nobody set by hand between Due and Overdue by due date."""
    today = today or timezone.localdate()
    changed = 0
    for model in (Invoice, Payable):
        qs = model.objects.filter(status_manual=False, status__in=OPEN_STATUSES)
        if workspace is not None:
            qs = qs.filter(workspace_company=workspace[0], workspace_region=workspace[1])
        changed += qs.filter(status='DUE', due_date__lt=today).update(status='OVERDUE')
        changed += qs.filter(status='OVERDUE').exclude(due_date__lt=today).update(status='DUE')
    return changed


@transaction.atomic
def change_status(row: Invoice | Payable, to_status: str, user, note: str = '') -> FinanceStatusChange | None:
    from_status = row.status
    if from_status == to_status and row.status_manual:
        return None
    row.status = to_status
    row.status_manual = True
    fields = ['status', 'status_manual', 'updated_at']
    if isinstance(row, Invoice):
        if to_status == InvoiceStatus.RECEIVED:
            row.amount_received = row.amount
            if not row.received_date:
                row.received_date = timezone.localdate()
        else:
            row.amount_received = Decimal('0')
        fields += ['amount_received', 'received_date']
    row.save(update_fields=fields)
    target = {'invoice': row} if isinstance(row, Invoice) else {'payable': row}
    return FinanceStatusChange.objects.create(
        **target,
        from_status=from_status,
        to_status=to_status,
        note=(note or '').strip(),
        changed_by=user,
    )
