"""Page KPI summaries for TechPay ledger screens."""

from __future__ import annotations

from collections import defaultdict
from decimal import Decimal

from django.db.models import Count, Q, Sum

from apps.business.models import Company
from apps.finance.workspace import scoped
from apps.finance.models import (
    CashflowAccount,
    CashflowDirection,
    CashflowEntry,
    OPEN_STATUSES,
    Invoice,
    InvoiceStatus,
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


def cashflow_summary(
    date_from: str | None = None,
    date_to: str | None = None,
    account: str = CashflowAccount.CURRENT,
) -> dict:
    """Category totals per direction; the Opening balance row is a balance, not a flow, so it is excluded."""
    qs = _date_filtered(scoped(CashflowEntry.objects).filter(account=account), 'entry_date', date_from, date_to)
    qs = qs.exclude(Q(sub_category__iexact='Opening') | Q(category__iexact='Opening Balance'))
    inflow_by: dict[str, Decimal] = defaultdict(Decimal)
    outflow_by: dict[str, Decimal] = defaultdict(Decimal)
    for row in qs.only('category', 'direction', 'amount'):
        key = row.category or 'Others'
        if row.direction == CashflowDirection.INFLOW:
            inflow_by[key] += row.amount
        else:
            outflow_by[key] += row.amount

    def _cards(totals: dict[str, Decimal], direction: str) -> list[dict]:
        cards = [
            {'category': key, 'amount': _money(value), 'direction': direction}
            for key, value in totals.items()
            if value
        ]
        cards.sort(key=lambda card: (-card['amount'], card['category']))
        return cards

    total_in = sum(inflow_by.values(), Decimal('0'))
    total_out = sum(outflow_by.values(), Decimal('0'))
    categories = []
    for key in sorted(set(inflow_by) | set(outflow_by)):
        inflow = inflow_by.get(key, Decimal('0'))
        outflow = outflow_by.get(key, Decimal('0'))
        categories.append({
            'category': key,
            'inflow': _money(inflow),
            'outflow': _money(outflow),
            'net': _money(inflow - outflow),
        })
    categories.sort(key=lambda row: -(row['inflow'] + row['outflow']))
    return {
        'account': account,
        'has_entries': scoped(CashflowEntry.objects).filter(account=account).exists(),
        'total_inflow': _money(total_in),
        'total_outflow': _money(total_out),
        'net': _money(total_in - total_out),
        'by_category': categories,
        'inflow_cards': _cards(inflow_by, 'Inflow'),
        'outflow_cards': _cards(outflow_by, 'Outflow'),
    }


def payables_summary(date_from: str | None = None, date_to: str | None = None) -> dict:
    qs = _date_filtered(scoped(Payable.objects).all(), 'invoice_date', date_from, date_to)
    total = qs.aggregate(total=Sum('payable_amount'))['total'] or Decimal('0')
    paid_qs = qs.filter(status=PayableStatus.PAID)
    pending_qs = qs.filter(status__in=OPEN_STATUSES)
    overdue_qs = qs.filter(status=PayableStatus.OVERDUE)
    paid = paid_qs.aggregate(total=Sum('payable_amount'))['total'] or Decimal('0')
    outstanding = pending_qs.aggregate(total=Sum('payable_amount'))['total'] or Decimal('0')
    overdue = overdue_qs.aggregate(total=Sum('payable_amount'))['total'] or Decimal('0')
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
        'overdue': _money(overdue),
        'tds_deducted': _money(tds),
        'paid_count': paid_qs.count(),
        'pending_count': pending_qs.count(),
        'overdue_count': overdue_qs.count(),
        'by_category': [
            {'category': row['category'] or 'Other', 'amount': _money(row['amount']), 'count': row['count']}
            for row in by_category
        ],
    }


def invoices_summary(date_from: str | None = None, date_to: str | None = None) -> dict:
    qs = _date_filtered(scoped(Invoice.objects).all(), 'invoice_date', date_from, date_to)
    aggregates = qs.aggregate(
        billed=Sum('amount'),
        gst=Sum('gst_amount'),
        tds=Sum('tds_amount'),
        taxable=Sum('taxable_amount'),
        received=Sum('amount_received'),
    )
    billed = aggregates['billed'] or Decimal('0')
    received = aggregates['received'] or Decimal('0')
    overdue = qs.filter(status=InvoiceStatus.OVERDUE).aggregate(
        total=Sum('amount') - Sum('amount_received'),
    )['total'] or Decimal('0')
    return {
        'count': qs.count(),
        'overdue': _money(overdue),
        'due_count': qs.filter(status=InvoiceStatus.DUE).count(),
        'overdue_count': qs.filter(status=InvoiceStatus.OVERDUE).count(),
        'received_count': qs.filter(status=InvoiceStatus.RECEIVED).count(),
        'billed': _money(billed),
        'gst': _money(aggregates['gst']),
        'tds': _money(aggregates['tds']),
        'taxable': _money(aggregates['taxable']),
        'received': _money(received),
        'outstanding': _money(billed - received),
    }


def clients_summary() -> dict:
    company_ids = set(scoped(Invoice.objects).filter(company__isnull=False).values_list('company_id', flat=True))
    company_ids |= set(scoped(PurchaseOrder.objects).filter(company__isnull=False).values_list('company_id', flat=True))
    companies = Company.objects.filter(id__in=company_ids)
    rows = []
    for company in companies:
        pos = scoped(company.purchase_orders.exclude(status=PurchaseOrderStatus.CANCELLED))
        invoices = scoped(company.invoices.all())
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
    for inv in scoped(Invoice.objects).filter(company__isnull=True):
        key = (inv.customer_name or '').strip()
        if not key or key.lower() in known:
            continue
        known.add(key.lower())
        paid = scoped(Invoice.objects).filter(customer_name=key).aggregate(total=Sum('amount_received'))['total'] or 0
        billed = scoped(Invoice.objects).filter(customer_name=key).aggregate(total=Sum('amount'))['total'] or 0
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
    qs = scoped(PurchaseOrder.objects).exclude(status=PurchaseOrderStatus.CANCELLED)
    return {
        'count': qs.count(),
        'active': qs.filter(status=PurchaseOrderStatus.ACTIVE).count(),
    }
