"""Bank Position summary from CashflowEntry (MIS Bank book)."""

from __future__ import annotations

from decimal import Decimal

from django.db.models import Sum

from apps.finance.models import CashflowDirection, CashflowEntry


def _money(value) -> float:
    return float(value or 0)


def _sum_amount(qs) -> Decimal:
    return qs.aggregate(total=Sum('amount'))['total'] or Decimal('0')


def get_bank_position(date_from: str | None = None, date_to: str | None = None) -> dict:
    """
    Operational Account from Current A/c Bank book cashflow.
    Seed Fund is Option 1 (awaiting Seed book); mirror Contra as transfer_to_ops.
    """
    qs = CashflowEntry.objects.all()
    if date_from:
        qs = qs.filter(entry_date__gte=date_from)
    if date_to:
        qs = qs.filter(entry_date__lte=date_to)

    opening_qs = qs.filter(sub_category__iexact='Opening')
    # If range has no Opening row, use latest Opening on/before from (or any Opening before activity).
    if not opening_qs.exists():
        prior = CashflowEntry.objects.filter(sub_category__iexact='Opening')
        if date_from:
            prior = prior.filter(entry_date__lte=date_from)
        opening_qs = prior.order_by('-entry_date')[:1]

    opening = _sum_amount(opening_qs)
    transfer_in = _sum_amount(
        qs.filter(sub_category__iexact='Contra', direction=CashflowDirection.INFLOW)
    )
    transfer_out = _sum_amount(
        qs.filter(sub_category__iexact='Contra', direction=CashflowDirection.OUTFLOW)
    )
    revenue_receipts = _sum_amount(
        qs.filter(sub_category__iexact='Receipt', direction=CashflowDirection.INFLOW)
    )
    all_outflows = _sum_amount(
        qs.filter(sub_category__iexact='Payment', direction=CashflowDirection.OUTFLOW)
    )
    closing = opening + revenue_receipts + transfer_in - all_outflows - transfer_out

    has_ops_activity = qs.exclude(sub_category__iexact='Opening').exists() or opening > 0

    period_label = ''
    if date_from and date_to:
        period_label = f'{date_from} · {date_to}'
    elif date_from:
        period_label = f'From {date_from}'
    elif date_to:
        period_label = f'Through {date_to}'
    else:
        period_label = 'All imported'

    return {
        'period_label': period_label,
        'combined_closing': _money(closing),
        'combined_scope': 'operational',
        'operational': {
            'available': has_ops_activity,
            'label': 'Operational Account',
            'subtitle': 'Current A/c · Day-to-Day',
            'opening': _money(opening),
            'transfer_in': _money(transfer_in),
            'transfer_out': _money(transfer_out),
            'revenue_receipts': _money(revenue_receipts),
            'all_outflows': _money(all_outflows),
            'closing': _money(closing),
        },
        'seed': {
            'available': False,
            'label': 'Seed Fund Account',
            'subtitle': 'Seedfund · Capital Pool',
            'opening': None,
            'disbursements': None,
            'transfer_to_ops': _money(transfer_in) if transfer_in else None,
            'closing': None,
            'status': 'awaiting_seed_bank_book',
        },
        'internal_transfer': _money(transfer_in),
    }
