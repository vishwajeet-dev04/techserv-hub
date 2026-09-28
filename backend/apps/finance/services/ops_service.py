from calendar import monthrange
from datetime import date
from decimal import Decimal

from django.db.models import Q, Sum
from django.db.models.functions import TruncMonth
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


def _parse_day(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


def _in_range(qs, field: str, date_from: date | None, date_to: date | None):
    if date_from:
        qs = qs.filter(**{f'{field}__gte': date_from})
    if date_to:
        qs = qs.filter(**{f'{field}__lte': date_to})
    return qs


def _po_in_range(qs, date_from: date | None, date_to: date | None):
    if date_from:
        qs = qs.filter(Q(po_date__gte=date_from) | Q(po_date__isnull=True, created_at__date__gte=date_from))
    if date_to:
        qs = qs.filter(Q(po_date__lte=date_to) | Q(po_date__isnull=True, created_at__date__lte=date_to))
    return qs


def _payable_in_range(qs, date_from: date | None, date_to: date | None):
    if date_from:
        qs = qs.filter(Q(due_date__gte=date_from) | Q(due_date__isnull=True, created_at__date__gte=date_from))
    if date_to:
        qs = qs.filter(Q(due_date__lte=date_to) | Q(due_date__isnull=True, created_at__date__lte=date_to))
    return qs


def get_ops_summary(date_from: str | None = None, date_to: str | None = None) -> dict:
    today = timezone.now().date()
    start = _parse_day(date_from)
    end = _parse_day(date_to)
    pos = _po_in_range(PurchaseOrder.objects.exclude(status=PurchaseOrderStatus.CANCELLED), start, end)
    total_po = pos.aggregate(total=Sum('total_value'))['total'] or Decimal('0')

    invoices = _in_range(Invoice.objects.all(), 'invoice_date', start, end)
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
    inflows = _in_range(CashflowEntry.objects.filter(direction=CashflowDirection.INFLOW), 'entry_date', start, end)
    outflows = _in_range(CashflowEntry.objects.filter(direction=CashflowDirection.OUTFLOW), 'entry_date', start, end)

    def _bucket_sum(qs, bucket):
        return _money(qs.filter(bucket=bucket).aggregate(total=Sum('amount'))['total'])

    total_inflow = _money(inflows.aggregate(total=Sum('amount'))['total'])
    total_outflow = _money(outflows.aggregate(total=Sum('amount'))['total'])
    pending_payables = _payable_in_range(
        Payable.objects.filter(status=PayableStatus.PENDING), start, end,
    ).aggregate(total=Sum('payable_amount'))['total'] or Decimal('0')

    capital = {}
    for item in _in_range(CapitalEntry.objects.all(), 'entry_date', start, end).values('capital_type').annotate(total=Sum('amount')):
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
            'payables': _payable_in_range(Payable.objects.all(), start, end).count(),
            'cashflow_entries': (inflows.count() + outflows.count()),
        },
        'as_of': today.isoformat(),
    }


def _month_start(d: date) -> date:
    return date(d.year, d.month, 1)


def _add_months(d: date, months: int) -> date:
    month = d.month - 1 + months
    year = d.year + month // 12
    month = month % 12 + 1
    return date(year, month, 1)


def _month_end(d: date) -> date:
    return date(d.year, d.month, monthrange(d.year, d.month)[1])


def _month_label(d: date) -> str:
    return d.strftime("%b '%y")


def _month_key(d: date) -> str:
    return f'{d.year:04d}-{d.month:02d}'


def get_ops_dashboard_series(date_from: str | None = None, date_to: str | None = None, months: int = 12) -> dict:
    """Aggregate series for Finance Dashboard analytics charts."""
    today = timezone.now().date()
    start = _parse_day(date_from)
    end = _parse_day(date_to)
    if start and end:
        if end < start:
            start, end = end, start
        start_month = _month_start(start)
        end_month = _month_start(end)
        span = (end_month.year - start_month.year) * 12 + (end_month.month - start_month.month) + 1
        months = max(1, min(span, 36))
        month_starts = [_add_months(start_month, i) for i in range(months)]
    else:
        end_month = _month_start(today)
        start_month = _add_months(end_month, -(months - 1))
        month_starts = [_add_months(start_month, i) for i in range(months)]

    billing_map = { _month_key(m): {'month': _month_key(m), 'label': _month_label(m), 'billed': 0.0, 'received': 0.0} for m in month_starts }
    billed_rows = (
        Invoice.objects.filter(invoice_date__gte=start_month, invoice_date__lte=_month_end(end_month))
        .annotate(month=TruncMonth('invoice_date'))
        .values('month')
        .annotate(total=Sum('amount'))
    )
    for row in billed_rows:
        if not row['month']:
            continue
        key = _month_key(row['month'].date() if hasattr(row['month'], 'date') else row['month'])
        if key in billing_map:
            billing_map[key]['billed'] = _money(row['total'])

    received_rows = (
        Invoice.objects.filter(received_date__gte=start_month, received_date__lte=_month_end(end_month))
        .annotate(month=TruncMonth('received_date'))
        .values('month')
        .annotate(total=Sum('amount_received'))
    )
    for row in received_rows:
        if not row['month']:
            continue
        key = _month_key(row['month'].date() if hasattr(row['month'], 'date') else row['month'])
        if key in billing_map:
            billing_map[key]['received'] = _money(row['total'])

    # Fallback: if no received_date coverage, attribute amount_received to invoice month
    if all(v['received'] == 0 for v in billing_map.values()):
        received_fallback = (
            Invoice.objects.filter(invoice_date__gte=start_month, invoice_date__lte=_month_end(end_month))
            .annotate(month=TruncMonth('invoice_date'))
            .values('month')
            .annotate(total=Sum('amount_received'))
        )
        for row in received_fallback:
            if not row['month']:
                continue
            key = _month_key(row['month'].date() if hasattr(row['month'], 'date') else row['month'])
            if key in billing_map:
                billing_map[key]['received'] = _money(row['total'])

    cash_map = {
        _month_key(m): {'month': _month_key(m), 'label': _month_label(m), 'inflow': 0.0, 'outflow': 0.0, 'net': 0.0}
        for m in month_starts
    }
    cash_rows = (
        CashflowEntry.objects.filter(entry_date__gte=start_month, entry_date__lte=_month_end(end_month))
        .annotate(month=TruncMonth('entry_date'))
        .values('month', 'direction')
        .annotate(total=Sum('amount'))
    )
    for row in cash_rows:
        if not row['month']:
            continue
        key = _month_key(row['month'].date() if hasattr(row['month'], 'date') else row['month'])
        if key not in cash_map:
            continue
        amount = _money(row['total'])
        if row['direction'] == CashflowDirection.INFLOW:
            cash_map[key]['inflow'] = amount
        else:
            cash_map[key]['outflow'] = amount
    for item in cash_map.values():
        item['net'] = item['inflow'] - item['outflow']

    category_rows = (
        _in_range(CashflowEntry.objects.filter(direction=CashflowDirection.INFLOW), 'entry_date', start, end)
        .values('category')
        .annotate(total=Sum('amount'))
        .order_by('-total')
    )
    inflow_by_category = [
        {'category': (row['category'] or 'Uncategorized'), 'amount': _money(row['total'])}
        for row in category_rows
        if row['total']
    ]

    aging_buckets = {
        '0-7': Decimal('0'),
        '8-30': Decimal('0'),
        '31-60': Decimal('0'),
        '61-90': Decimal('0'),
        '90+': Decimal('0'),
    }
    outstanding = _in_range(Invoice.objects.exclude(status=InvoiceStatus.PAID), 'invoice_date', start, end)
    for invoice in outstanding:
        balance = invoice.balance
        if balance <= 0:
            continue
        pending_from = invoice.due_date or invoice.invoice_date
        days = (today - pending_from).days
        if days <= 7:
            aging_buckets['0-7'] += balance
        elif days <= 30:
            aging_buckets['8-30'] += balance
        elif days <= 60:
            aging_buckets['31-60'] += balance
        elif days <= 90:
            aging_buckets['61-90'] += balance
        else:
            aging_buckets['90+'] += balance

    aging = [
        {'bucket': label, 'amount': _money(aging_buckets[label])}
        for label in ('0-7', '8-30', '31-60', '61-90', '90+')
    ]

    # Approximate month-end AR: open invoices dated on/before each month-end
    # (uses current amount_received — approximate historical trend).
    invoice_snapshot = list(
        Invoice.objects.values('invoice_date', 'amount', 'amount_received', 'status')
    )

    receivables_trend = []
    for month_start in month_starts:
        end = _month_end(month_start)
        total = Decimal('0')
        for inv in invoice_snapshot:
            if inv['invoice_date'] > end:
                continue
            if inv['status'] == InvoiceStatus.PAID:
                continue
            bal = Decimal(inv['amount'] or 0) - Decimal(inv['amount_received'] or 0)
            if bal > 0:
                total += bal
        receivables_trend.append({
            'month': _month_key(month_start),
            'label': _month_label(month_start),
            'amount': _money(total),
        })

    return {
        'as_of': today.isoformat(),
        'billing_vs_collections': [billing_map[_month_key(m)] for m in month_starts],
        'cash_in_out': [cash_map[_month_key(m)] for m in month_starts],
        'inflow_by_category': inflow_by_category,
        'aging': aging,
        'net_cash_monthly': [
            {
                'month': cash_map[_month_key(m)]['month'],
                'label': cash_map[_month_key(m)]['label'],
                'net': cash_map[_month_key(m)]['net'],
            }
            for m in month_starts
        ],
        'receivables_trend': receivables_trend,
    }
