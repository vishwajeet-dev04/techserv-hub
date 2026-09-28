"""Page KPI summaries for TechPay ledger screens."""

from __future__ import annotations

from collections import defaultdict
from decimal import Decimal

from django.db.models import Count, Q, Sum

from apps.business.models import Company
from apps.finance.models import (
    CashflowDirection,
    CashflowEntry,
    Invoice,
    Payable,
    PayableStatus,
    PurchaseOrder,
    PurchaseOrderStatus,
)


def _money(value) -> float:
    return float(value or 0)


def _date_filtered(qs, date_field: str, date_from: str | None, date_to: str | None):
    if date_from:
        qs = qs.filter(**{f'{date_field}__gte': date_from})
    if date_to:
        qs = qs.filter(**{f'{date_field}__lte': date_to})
    return qs


def cashflow_summary(date_from: str | None = None, date_to: str | None = None) -> dict:
    qs = _date_filtered(CashflowEntry.objects.all(), 'entry_date', date_from, date_to)
    by_category: dict[str, dict] = defaultdict(lambda: {'category': '', 'inflow': 0.0, 'outflow': 0.0, 'net': 0.0})
    total_in = Decimal('0')
    total_out = Decimal('0')
    for row in qs:
        key = row.category or 'Others'
        bucket = by_category[key]
        bucket['category'] = key
        if row.direction == CashflowDirection.INFLOW:
            bucket['inflow'] += float(row.amount)
            total_in += row.amount
        else:
            bucket['outflow'] += float(row.amount)
            total_out += row.amount
    categories = []
    for item in by_category.values():
        item['net'] = item['inflow'] - item['outflow']
        item['direction'] = 'Inflow' if item['inflow'] >= item['outflow'] else 'Outflow'
        if item['inflow'] and not item['outflow']:
            item['direction'] = 'Inflow'
            item['amount'] = item['inflow']
        elif item['outflow'] and not item['inflow']:
            item['direction'] = 'Outflow'
            item['amount'] = item['outflow']
        else:
            item['amount'] = abs(item['net'])
            item['direction'] = 'Net' if item['net'] else 'Net'
        categories.append(item)
    categories.sort(key=lambda row: -row['amount'])
    net = total_in - total_out
    return {
        'total_inflow': _money(total_in),
        'total_outflow': _money(total_out),
        'net': _money(net),
        'by_category': categories,
        'cards': categories + [{
            'category': 'TOTAL (Net)',
            'amount': _money(net),
            'direction': 'Net',
            'inflow': _money(total_in),
            'outflow': _money(total_out),
            'net': _money(net),
        }],
    }


def payables_summary(date_from: str | None = None, date_to: str | None = None) -> dict:
    qs = _date_filtered(Payable.objects.all(), 'due_date', date_from, date_to)
    total = qs.aggregate(total=Sum('payable_amount'))['total'] or Decimal('0')
    paid_qs = qs.filter(status=PayableStatus.PAID)
    pending_qs = qs.filter(status=PayableStatus.PENDING)
    paid = paid_qs.aggregate(total=Sum('payable_amount'))['total'] or Decimal('0')
    outstanding = pending_qs.aggregate(total=Sum('payable_amount'))['total'] or Decimal('0')
    tds = qs.aggregate(total=Sum('tds_amount'))['total'] or Decimal('0')
    by_category = list(
        qs.values('category')
        .annotate(amount=Sum('payable_amount'), count=Count('id'))
        .order_by('-amount')
    )
    return {
        'total_payable': _money(total),
        'total_paid': _money(paid),
        'outstanding': _money(outstanding),
        'tds_deducted': _money(tds),
        'paid_count': paid_qs.count(),
        'pending_count': pending_qs.count(),
        'by_category': [
            {'category': row['category'] or 'Other', 'amount': _money(row['amount']), 'count': row['count']}
            for row in by_category
        ],
    }


def invoices_summary(date_from: str | None = None, date_to: str | None = None) -> dict:
    qs = _date_filtered(Invoice.objects.all(), 'invoice_date', date_from, date_to)
    aggregates = qs.aggregate(
        billed=Sum('amount'),
        gst=Sum('gst_amount'),
        tds=Sum('tds_amount'),
        taxable=Sum('taxable_amount'),
        received=Sum('amount_received'),
    )
    billed = aggregates['billed'] or Decimal('0')
    received = aggregates['received'] or Decimal('0')
    return {
        'count': qs.count(),
        'billed': _money(billed),
        'gst': _money(aggregates['gst']),
        'tds': _money(aggregates['tds']),
        'taxable': _money(aggregates['taxable']),
        'received': _money(received),
        'outstanding': _money(billed - received),
    }


def clients_summary() -> dict:
    companies = Company.objects.filter(
        Q(invoices__isnull=False) | Q(purchase_orders__isnull=False)
    ).distinct()
    rows = []
    for company in companies:
        pos = company.purchase_orders.exclude(status=PurchaseOrderStatus.CANCELLED)
        invoices = company.invoices.all()
        invoiced = invoices.aggregate(total=Sum('amount'))['total'] or Decimal('0')
        paid = invoices.aggregate(total=Sum('amount_received'))['total'] or Decimal('0')
        service = pos.values_list('service_category', flat=True).first() or ''
        rows.append({
            'id': str(company.id),
            'name': company.name,
            'service_line': service,
            'gst_number': company.gst_number or '',
            'active_pos': pos.filter(status=PurchaseOrderStatus.ACTIVE).count(),
            'total_invoiced': _money(invoiced),
            'total_paid': _money(paid),
        })
    # Also include invoice customers without company FK
    known = {row['name'].lower() for row in rows}
    for inv in Invoice.objects.filter(company__isnull=True):
        key = (inv.customer_name or '').strip()
        if not key or key.lower() in known:
            continue
        known.add(key.lower())
        paid = Invoice.objects.filter(customer_name=key).aggregate(total=Sum('amount_received'))['total'] or 0
        billed = Invoice.objects.filter(customer_name=key).aggregate(total=Sum('amount'))['total'] or 0
        rows.append({
            'id': key,
            'name': key,
            'service_line': '',
            'gst_number': '',
            'active_pos': 0,
            'total_invoiced': _money(billed),
            'total_paid': _money(paid),
        })
    rows.sort(key=lambda item: -item['total_invoiced'])
    return {
        'active_clients': len(rows),
        'clients': rows,
    }


def purchase_orders_summary() -> dict:
    qs = PurchaseOrder.objects.exclude(status=PurchaseOrderStatus.CANCELLED)
    return {
        'count': qs.count(),
        'active': qs.filter(status=PurchaseOrderStatus.ACTIVE).count(),
    }
