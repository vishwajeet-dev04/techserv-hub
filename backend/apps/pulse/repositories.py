from __future__ import annotations

from django.db.models import (
    Case,
    Count,
    DecimalField,
    F,
    IntegerField,
    OuterRef,
    Q,
    QuerySet,
    Subquery,
    Sum,
    Value,
    When,
)
from django.db.models.functions import Coalesce

from apps.business.models import Company
from apps.pulse.models import Opportunity, PulseContact, Reminder
from apps.users.models import User


DISPLAY_AMOUNT = Case(
    When(negotiated_amount__gt=0, then=F('negotiated_amount')),
    default=F('expected_amount'),
    output_field=DecimalField(max_digits=15, decimal_places=2),
)


def _open_po_issue_count():
    from apps.deals.models import PoDocumentIssue, PoDocumentIssueStatus

    counts = (
        PoDocumentIssue.objects.filter(opportunity=OuterRef('pk'), status=PoDocumentIssueStatus.OPEN)
        .order_by()
        .values('opportunity')
        .annotate(total=Count('id'))
        .values('total')
    )
    return Coalesce(Subquery(counts, output_field=IntegerField()), Value(0))


STAGE_VALUE = Case(
    When(stage='Negotiation', then=F('negotiated_amount')),
    default=DISPLAY_AMOUNT,
    output_field=DecimalField(max_digits=15, decimal_places=2),
)


class CompanyLookupRepository:
    def get_or_create_by_name(self, name: str) -> Company:
        clean = name.strip()
        existing = Company.objects.filter(name__iexact=clean).order_by('created_at').first()
        return existing or Company.objects.create(name=clean)


class PulseContactRepository:
    def list(self, search: str | None = None) -> QuerySet:
        qs = PulseContact.objects.select_related('company')
        if search:
            qs = qs.filter(
                Q(name__icontains=search)
                | Q(email__icontains=search)
                | Q(company__name__icontains=search)
                | Q(designation__icontains=search)
                | Q(department__icontains=search)
                | Q(phone__icontains=search)
                | Q(city__icontains=search)
            )
        return qs.order_by('name')

    def get(self, pk) -> PulseContact:
        return PulseContact.objects.select_related('company').get(pk=pk)

    def find_by_company_and_name(self, company_name: str, contact_name: str) -> PulseContact | None:
        return (
            PulseContact.objects.select_related('company')
            .filter(company__name__iexact=company_name.strip(), name__iexact=contact_name.strip())
            .first()
        )

    def company_names(self) -> list[str]:
        return list(
            PulseContact.objects.select_related('company')
            .order_by('company__name')
            .values_list('company__name', flat=True)
            .distinct()
        )

    def create(self, **fields) -> PulseContact:
        return PulseContact.objects.create(**fields)

    def save(self, instance: PulseContact) -> PulseContact:
        instance.save()
        return instance

    def delete(self, instance: PulseContact) -> None:
        instance.delete()

    def count(self, created_from=None, created_to=None) -> int:
        return self.filtered(created_from=created_from, created_to=created_to).count()

    def filtered(self, created_from=None, created_to=None) -> QuerySet:
        qs = PulseContact.objects.all()
        if created_from is not None:
            qs = qs.filter(created_at__gte=created_from)
        if created_to is not None:
            qs = qs.filter(created_at__lte=created_to)
        return qs


class OpportunityRepository:
    def list(self, search: str | None = None, stage: str | None = None) -> QuerySet:
        qs = (
            Opportunity.objects.select_related('company', 'owner', 'contact', 'contact__company')
            .prefetch_related('po_workflows')
            .annotate(open_po_issue_count=_open_po_issue_count())
        )
        if search:
            qs = qs.filter(
                Q(name__icontains=search)
                | Q(prospect_number__icontains=search)
                | Q(company__name__icontains=search)
                | Q(contact__name__icontains=search)
                | Q(owner_name__icontains=search)
                | Q(service_pillar__icontains=search)
            )
        if stage:
            qs = qs.filter(stage=stage)
        return qs.order_by('-created_at')

    def get(self, pk) -> Opportunity:
        return (
            Opportunity.objects.select_related('company', 'owner', 'contact')
            .prefetch_related('po_workflows')
            .annotate(open_po_issue_count=_open_po_issue_count())
            .get(pk=pk)
        )

    def prospect_number_taken(self, value: str) -> bool:
        return Opportunity.objects.filter(prospect_number__iexact=value.strip()).exists()

    def max_prospect_suffix(self) -> int:
        numbers = Opportunity.objects.values_list('prospect_number', flat=True)
        highest = 0
        for item in numbers:
            if not item:
                continue
            prefix, _, suffix = item.upper().partition('PRO-')
            if prefix:
                continue
            if suffix.isdigit():
                highest = max(highest, int(suffix))
        return highest

    def create(self, **fields) -> Opportunity:
        return Opportunity.objects.create(**fields)

    def save(self, instance: Opportunity) -> Opportunity:
        instance.save()
        return instance

    def filtered(self, created_from=None, created_to=None) -> QuerySet:
        qs = Opportunity.objects.all()
        if created_from is not None:
            qs = qs.filter(created_at__gte=created_from)
        if created_to is not None:
            qs = qs.filter(created_at__lte=created_to)
        return qs

    def stage_totals(self, qs: QuerySet) -> dict[str, dict]:
        rows = qs.values('stage').annotate(count=Count('id'), value=Sum(STAGE_VALUE))
        return {row['stage']: row for row in rows}

    def source_counts(self, qs: QuerySet) -> list[dict]:
        rows = (
            qs.values('lead_source')
            .annotate(total=Count('id'))
            .order_by('-total')
        )
        return [
            {'name': (row['lead_source'] or '').strip() or 'Unspecified', 'count': row['total']}
            for row in rows
        ]

    def expected_vs_negotiated_by_company(self, qs: QuerySet, limit: int = 8) -> list[dict]:
        from django.db.models.functions import Greatest

        rows = (
            qs.values('company__name')
            .annotate(expected=Sum('expected_amount'), negotiated=Sum('negotiated_amount'))
            .annotate(rank=Greatest(F('expected'), F('negotiated')))
            .order_by('-rank')[:limit]
        )
        return list(rows)

    def pipeline_value(self, qs: QuerySet, exclude_stages: set[str]):
        return qs.exclude(stage__in=exclude_stages).aggregate(total=Sum(DISPLAY_AMOUNT))['total']

    def delete(self, instance: Opportunity) -> None:
        instance.delete()

    def summary(self) -> dict:
        qs = Opportunity.objects.all()
        totals = qs.aggregate(
            expected=Sum('expected_amount'),
            negotiated=Sum('negotiated_amount'),
        )
        return {
            'count': qs.count(),
            'open_count': qs.filter(status='OPEN').count(),
            'won_count': qs.filter(status='WON').count(),
            'lost_count': qs.filter(status='LOST').count(),
            'expected_total': totals['expected'],
            'negotiated_total': totals['negotiated'],
        }


class ReminderRepository:
    def list(self, search: str | None = None, status: str | None = None, reminder_type: str | None = None) -> QuerySet:
        qs = Reminder.objects.select_related('opportunity', 'contact', 'opportunity__company')
        if search:
            qs = qs.filter(Q(title__icontains=search) | Q(description__icontains=search))
        if status:
            qs = qs.filter(status=status)
        if reminder_type:
            qs = qs.filter(reminder_type=reminder_type)
        return qs.order_by('-created_at')

    def get(self, pk) -> Reminder:
        return Reminder.objects.select_related('opportunity', 'contact').get(pk=pk)

    def create(self, **fields) -> Reminder:
        return Reminder.objects.create(**fields)

    def save(self, instance: Reminder) -> Reminder:
        instance.save()
        return instance

    def delete(self, instance: Reminder) -> None:
        instance.delete()

    def pending_count(self) -> int:
        return Reminder.objects.filter(status='PENDING').count()


class UserLookupRepository:
    def list_active(self) -> QuerySet:
        return User.objects.filter(is_active=True).order_by('name')

    def get_active_by_id(self, user_id) -> User | None:
        if not user_id:
            return None
        return User.objects.filter(pk=user_id, is_active=True).first()

    def find_by_name(self, name: str) -> User | None:
        if not name.strip():
            return None
        return User.objects.filter(is_active=True, name__iexact=name.strip()).first()
