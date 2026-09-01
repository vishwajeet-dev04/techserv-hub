import logging
from django.db.models import QuerySet, Q, Count
from apps.business.models import Company, CompanyStatus

logger = logging.getLogger(__name__)


def get_company(company_id) -> Company:
    return (
        Company.objects
        .select_related('owner')
        .prefetch_related('contacts')
        .get(pk=company_id)
    )


def get_company_list(
    search: str = None,
    status: str = None,
    owner_id=None,
) -> QuerySet:
    qs = (
        Company.objects
        .select_related('owner')
        .prefetch_related('contacts')
        .annotate(
            annotated_contact_count=Count('contacts', distinct=True),
            annotated_deal_count=Count('deals', distinct=True),
        )
    )

    if search:
        qs = qs.filter(
            Q(name__icontains=search) |
            Q(industry__icontains=search) |
            Q(location__icontains=search)
        )

    if status:
        qs = qs.filter(status=status)

    if owner_id:
        qs = qs.filter(owner_id=owner_id)

    return qs.order_by('name')


def get_company_stats() -> dict:
    counts = Company.objects.values('status').annotate(count=Count('id'))
    stats = {item['status']: item['count'] for item in counts}

    return {
        'total': sum(stats.values()),
        'customers': stats.get(CompanyStatus.CUSTOMER, 0),
        'prospects': stats.get(CompanyStatus.PROSPECT, 0),
        'partners': stats.get(CompanyStatus.PARTNER, 0),
        'inactive': stats.get(CompanyStatus.INACTIVE, 0),
    }