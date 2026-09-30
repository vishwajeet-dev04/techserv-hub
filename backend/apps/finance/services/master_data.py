"""Ledger stats for finance master data rows, matched by company link or name."""

from __future__ import annotations

from collections import defaultdict
from decimal import Decimal
from typing import Iterable

from django.db.models import Count, Q, Sum
from django.db.models.functions import Lower, Trim

from apps.finance.models import (
    FinanceClient,
    FinanceVendor,
    Invoice,
    Payable,
    PayableStatus,
    PurchaseOrder,
    PurchaseOrderStatus,
)


def _blank() -> dict:
    return {'active_pos': 0, 'invoiced': Decimal('0'), 'paid': Decimal('0')}


def client_stats(clients: Iterable[FinanceClient]) -> dict:
    by_company: dict = defaultdict(_blank)
    by_name: dict = defaultdict(_blank)
    company_by_name: dict[str, object] = {}

    linked_invoices = (
        Invoice.objects.filter(company__isnull=False)
        .values('company_id', 'company__name')
        .annotate(invoiced=Sum('amount'), paid=Sum('amount_received'))
    )
    for row in linked_invoices:
        bucket = by_company[row['company_id']]
        bucket['invoiced'] += row['invoiced'] or 0
        bucket['paid'] += row['paid'] or 0
        company_by_name.setdefault((row['company__name'] or '').strip().lower(), row['company_id'])

    linked_pos = (
        PurchaseOrder.objects.filter(company__isnull=False, status=PurchaseOrderStatus.ACTIVE)
        .values('company_id', 'company__name')
        .annotate(count=Count('id'))
    )
    for row in linked_pos:
        by_company[row['company_id']]['active_pos'] += row['count']
        company_by_name.setdefault((row['company__name'] or '').strip().lower(), row['company_id'])

    loose_invoices = (
        Invoice.objects.filter(company__isnull=True)
        .annotate(key=Lower(Trim('customer_name')))
        .values('key')
        .annotate(invoiced=Sum('amount'), paid=Sum('amount_received'))
    )
    for row in loose_invoices:
        bucket = by_name[row['key']]
        bucket['invoiced'] += row['invoiced'] or 0
        bucket['paid'] += row['paid'] or 0

    loose_pos = (
        PurchaseOrder.objects.filter(company__isnull=True, status=PurchaseOrderStatus.ACTIVE)
        .annotate(key=Lower(Trim('customer_name')))
        .values('key')
        .annotate(count=Count('id'))
    )
    for row in loose_pos:
        by_name[row['key']]['active_pos'] += row['count']

    result = {}
    for client in clients:
        key = client.name.strip().lower()
        company_id = client.company_id or company_by_name.get(key)
        linked = by_company.get(company_id) if company_id else None
        loose = by_name.get(key)
        parts = [part for part in (linked, loose) if part]
        result[client.pk] = {
            'active_pos': sum(part['active_pos'] for part in parts),
            'total_invoiced': float(sum((part['invoiced'] for part in parts), Decimal('0'))),
            'total_paid': float(sum((part['paid'] for part in parts), Decimal('0'))),
        }
    return result


def vendor_stats(vendors: Iterable[FinanceVendor]) -> dict:
    grouped = {
        row['key']: row
        for row in Payable.objects.annotate(key=Lower(Trim('vendor')))
        .values('key')
        .annotate(
            total=Sum('payable_amount'),
            outstanding=Sum('payable_amount', filter=Q(status=PayableStatus.PENDING)),
        )
    }
    result = {}
    for vendor in vendors:
        row = grouped.get(vendor.name.strip().lower()) or {}
        result[vendor.pk] = {
            'total_payable': float(row.get('total') or 0),
            'outstanding': float(row.get('outstanding') or 0),
        }
    return result
