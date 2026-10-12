"""Bank Position summary from CashflowEntry (MIS Bank book per account)."""

from __future__ import annotations

from decimal import Decimal

from django.db.models import Sum

from apps.finance.models import CashflowAccount, CashflowDirection, CashflowEntry
from apps.finance.workspace import scoped


def _money(value) -> float:
    return float(value or 0)


def _sum_amount(qs) -> Decimal:
    return qs.aggregate(total=Sum('amount'))['total'] or Decimal('0')


def _account_position(account: str, date_from: str | None, date_to: str | None) -> dict:
    base = scoped(CashflowEntry.objects).filter(account=account)
    qs = base
    if date_from:
        qs = qs.filter(entry_date__gte=date_from)
    if date_to:
        qs = qs.filter(entry_date__lte=date_to)

    opening_qs = qs.filter(sub_category__iexact='Opening')
    # If range has no Opening row, use latest Opening on/before from (or any Opening before activity).
    if not opening_qs.exists():
        prior = base.filter(sub_category__iexact='Opening')
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
    receipts = _sum_amount(
        qs.filter(sub_category__iexact='Receipt', direction=CashflowDirection.INFLOW)
    )
    outflows = _sum_amount(
        qs.filter(sub_category__iexact='Payment', direction=CashflowDirection.OUTFLOW)
    )
    closing = opening + receipts + transfer_in - outflows - transfer_out
    return {
        'available': qs.exclude(sub_category__iexact='Opening').exists() or opening > 0,
        'opening': opening,
        'transfer_in': transfer_in,
        'transfer_out': transfer_out,
        'receipts': receipts,
        'outflows': outflows,
        'closing': closing,
    }


def get_bank_position(
    date_from: str | None = None,
    date_to: str | None = None,
    account: str = CashflowAccount.CURRENT,
) -> dict:
    """Operational (Current A/c) and Seed Fund positions from their Bank books."""
    ops = _account_position(CashflowAccount.CURRENT, date_from, date_to)
    seed = _account_position(CashflowAccount.SEED, date_from, date_to)

    period_label = ''
    if date_from and date_to:
        period_label = f'{date_from} · {date_to}'
    elif date_from:
        period_label = f'From {date_from}'
    elif date_to:
        period_label = f'Through {date_to}'
    else:
        period_label = 'All imported'

    selected = seed if account == CashflowAccount.SEED else ops
    return {
        'period_label': period_label,
        'account': account,
        'combined_closing': _money(selected['closing']),
        'combined_scope': 'seed' if account == CashflowAccount.SEED else 'operational',
        'operational': {
            'available': ops['available'],
            'label': 'Operational Account',
            'subtitle': 'Current A/c · Day-to-Day',
            'opening': _money(ops['opening']),
            'transfer_in': _money(ops['transfer_in']),
            'transfer_out': _money(ops['transfer_out']),
            'revenue_receipts': _money(ops['receipts']),
            'all_outflows': _money(ops['outflows']),
            'closing': _money(ops['closing']),
        },
        'seed': {
            'available': seed['available'],
            'label': 'Seed Fund Account',
            'subtitle': 'Seedfund · Capital Pool',
            'opening': _money(seed['opening']) if seed['available'] else None,
            'receipts': _money(seed['receipts']) if seed['available'] else None,
            'disbursements': _money(seed['outflows']) if seed['available'] else None,
            'transfer_to_ops': _money(seed['transfer_out'] or ops['transfer_in']) or None,
            'closing': _money(seed['closing']) if seed['available'] else None,
            'status': 'available' if seed['available'] else 'awaiting_seed_bank_book',
        },
        'internal_transfer': _money(ops['transfer_in']),
    }
