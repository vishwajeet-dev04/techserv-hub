from decimal import Decimal

from django.db.models import Sum
from django.utils import timezone

from apps.finance.models import (
    CapitalEntry,
    CashflowDirection,
    CashflowEntry,
    Invoice,
    InvoiceStatus,
    Payable,
    PayableStatus,
    PurchaseOrder,
    PurchaseOrderStatus,
)


def _money(value) -> float:
    return float(value or 0)


def get_ops_summary() -> dict:
    today = timezone.now().date()
    pos = PurchaseOrder.objects.exclude(status=PurchaseOrderStatus.CANCELLED)
    total_po = pos.aggregate(total=Sum('total_value'))['total'] or Decimal('0')

    invoices = Invoice.objects.all()
    total_invoiced = invoices.aggregate(total=Sum('amount'))['total'] or Decimal('0')
    open_po = total_po - total_invoiced
    if open_po < 0:
        open_po = Decimal('0')

    active_pos = pos.filter(status=PurchaseOrderStatus.ACTIVE)
    scheduled = active_pos.aggregate(total=Sum('monthly_billing'))['total'] or Decimal('0')
    to_be_invoiced = scheduled if scheduled > 0 else Decimal('0')

    outstanding = invoices.exclude(status=InvoiceStatus.PAID)
    receivables = sum((inv.balance for inv in outstanding), Decimal('0'))

    due_0_7 = Decimal('0')
    due_8_30 = Decimal('0')
    overdue = Decimal('0')
    due_rows = []
    overdue_rows = []

    for invoice in outstanding.select_related('company', 'purchase_order'):
        balance = invoice.balance
        if balance <= 0:
            continue
        pending_from = invoice.due_date or invoice.invoice_date
        days = (today - pending_from).days
        row = {
            'id': str(invoice.id),
            'invoice_number': invoice.invoice_number,
            'customer_name': invoice.customer_name or (invoice.company.name if invoice.company else ''),
            'amount': _money(balance),
            'invoice_date': invoice.invoice_date.isoformat(),
            'due_date': invoice.due_date.isoformat() if invoice.due_date else None,
            'pending_since': pending_from.isoformat(),
            'days_pending': days,
        }
        if days <= 7:
            due_0_7 += balance
            due_rows.append(row)
        elif days <= 30:
            due_8_30 += balance
            due_rows.append(row)
        else:
            overdue += balance
            overdue_rows.append(row)

    due_total = due_0_7 + due_8_30
    inflows = CashflowEntry.objects.filter(direction=CashflowDirection.INFLOW)
    outflows = CashflowEntry.objects.filter(direction=CashflowDirection.OUTFLOW)

    def _bucket_sum(qs, bucket):
        return _money(qs.filter(bucket=bucket).aggregate(total=Sum('amount'))['total'])

    total_inflow = _money(inflows.aggregate(total=Sum('amount'))['total'])
    total_outflow = _money(outflows.aggregate(total=Sum('amount'))['total'])
    pending_payables = Payable.objects.filter(status=PayableStatus.PENDING).aggregate(
        total=Sum('payable_amount')
    )['total'] or Decimal('0')

    capital = {}
    for item in CapitalEntry.objects.values('capital_type').annotate(total=Sum('amount')):
        capital[item['capital_type']] = _money(item['total'])

    return {
        'po_metrics': {
            'total_po_value': _money(total_po),
            'open_po': _money(open_po),
            'to_be_invoiced': _money(to_be_invoiced),
        },
        'revenue_metrics': {
            'invoiced': _money(total_invoiced),
        },
        'receivables': {
            'total': _money(receivables),
            'due': _money(due_total),
            'due_0_7': _money(due_0_7),
            'due_8_30': _money(due_8_30),
            'overdue': _money(overdue),
            'due_invoices': due_rows[:20],
            'overdue_invoices': overdue_rows[:20],
        },
        'cashflow_metrics': {
            'total_inflow': total_inflow,
            'total_outflow': total_outflow,
            'net_cash_movement': total_inflow - total_outflow,
            'revenue_inflow': _bucket_sum(inflows, 'REVENUE'),
            'revenue_outflow': _bucket_sum(outflows, 'OPERATING'),
            'capital_inflow': _bucket_sum(inflows, 'CAPITAL'),
            'capital_outflow': _bucket_sum(outflows, 'CAPITAL'),
        },
        'payables_pending': _money(pending_payables),
        'capital': capital,
        'counts': {
            'purchase_orders': pos.count(),
            'invoices': invoices.count(),
            'payables': Payable.objects.count(),
            'cashflow_entries': CashflowEntry.objects.count(),
        },
        'as_of': today.isoformat(),
    }
