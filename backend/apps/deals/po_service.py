from datetime import date, datetime, time
from decimal import Decimal

from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import ValidationError as DrfValidationError

from apps.business.models import Company
from apps.deals.models import PoWorkflow
from apps.deals.po_excel import (
    build_po_workbook,
    dummy_po_rows,
    load_po_rows_from_workbook,
    open_upload,
    po_export_row,
)

REQUIRED = {
    'customer_name': 'Customer',
    'billing_entity': 'Billing Entity',
    'service_pillar': 'Service Pillar',
    'po_number': 'PO Number',
    'agreement': 'Agreement',
    'billing_cycle': 'Billing Cycle',
    'billing_due': 'Billing Due',
}


def list_po_workflows(
    search: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    customer: str | None = None,
    billing_entity: str | None = None,
    opportunity: str | None = None,
):
    qs = PoWorkflow.objects.select_related('company', 'opportunity', 'opportunity__company')
    if opportunity:
        qs = qs.filter(opportunity_id=opportunity)
    if search:
        term = search.strip()
        qs = qs.filter(
            Q(customer_name__icontains=term)
            | Q(po_number__icontains=term)
            | Q(billing_entity__icontains=term)
            | Q(service_pillar__icontains=term)
            | Q(billing_cycle__icontains=term)
            | Q(billing_due__icontains=term)
            | Q(opportunity__prospect_number__icontains=term)
            | Q(opportunity__name__icontains=term)
        )
    if customer and customer.strip():
        qs = qs.filter(customer_name=customer.strip())
    if billing_entity and billing_entity.strip():
        qs = qs.filter(billing_entity=billing_entity.strip())
    range_from, range_to = _day_bounds(date_from, date_to)
    items = [item for item in qs if _in_range(item, range_from, range_to)]
    if not items:
        return PoWorkflow.objects.none()
    ordered = {item.pk: index for index, item in enumerate(items)}
    return (
        PoWorkflow.objects.filter(pk__in=ordered)
        .select_related('company', 'opportunity', 'opportunity__company')
        .order_by('-created_at')
    )

def po_status(item: PoWorkflow) -> str:
    today = timezone.localdate()
    if item.end_date and item.end_date < today:
        return 'Completed'
    return 'Active'


def po_display(item: PoWorkflow) -> str:
    number = (item.po_number or '').strip()
    if not number or number == '-':
        return f'PO-{item.customer_name}'
    return number


def po_dashboard(
    date_from: str | None = None,
    date_to: str | None = None,
    customer: str | None = None,
    billing_entity: str | None = None,
    search: str | None = None,
) -> dict:
    from apps.deals.serializers import PoWorkflowSerializer

    qs = list_po_workflows(
        search=search,
        date_from=date_from,
        date_to=date_to,
        customer=customer,
        billing_entity=billing_entity,
    )
    rows = list(qs)
    all_rows = list(PoWorkflow.objects.order_by('customer_name').only('customer_name', 'billing_entity'))
    clients = sorted({row.customer_name for row in all_rows if row.customer_name})
    vendors = sorted({row.billing_entity for row in all_rows if row.billing_entity})
    active = [row for row in rows if po_status(row) == 'Active']
    totals = [row.total_value or Decimal('0') for row in rows]
    monthly = [row.value_per_invoice for row in rows if row.value_per_invoice is not None]
    durations = []
    for row in rows:
        if row.start_date and row.end_date and row.end_date >= row.start_date:
            durations.append((row.end_date - row.start_date).days / 30.4375)
    by_category: dict[str, Decimal] = {}
    for row in rows:
        name = row.service_pillar or 'Unspecified'
        by_category[name] = by_category.get(name, Decimal('0')) + (row.total_value or Decimal('0'))
    timeline = []
    for row in rows:
        start, end = _span(row)
        timeline.append({
            'id': str(row.id),
            'po_display': po_display(row),
            'customer_name': row.customer_name,
            'start': start.isoformat() if start else None,
            'end': end.isoformat() if end else None,
            'status': po_status(row),
        })
    return {
        'kpis': {
            'active_pos': len(active),
            'total_contract_value': float(sum(totals)),
            'avg_monthly_billing': float(sum(monthly) / len(monthly)) if monthly else 0.0,
            'avg_duration_months': round(sum(durations) / len(durations), 1) if durations else 0.0,
        },
        'by_category': [
            {'name': name, 'value': float(value)}
            for name, value in sorted(by_category.items(), key=lambda item: -item[1])
        ],
        'timeline': timeline,
        'rows': PoWorkflowSerializer(rows, many=True).data,
        'clients': clients,
        'vendors': vendors,
    }


def _span(item: PoWorkflow):
    start = item.start_date or item.po_date
    end = item.end_date or item.expiry or start
    return start, end


def _in_range(item: PoWorkflow, range_from: date | None, range_to: date | None) -> bool:
    if range_from is None and range_to is None:
        return True
    start, end = _span(item)
    if start is None:
        return False
    if range_from and end < range_from:
        return False
    if range_to and start > range_to:
        return False
    return True


def _day_bounds(date_from: str | None, date_to: str | None):
    start = _parse_day(date_from, end=False)
    end = _parse_day(date_to, end=True)
    if start and end and start > end:
        raise DrfValidationError({'from': 'Start date must be on or before end date.'})
    return (start.date() if start else None), (end.date() if end else None)


def _parse_day(value: str | None, *, end: bool):
    if not value or not str(value).strip():
        return None
    try:
        day = date.fromisoformat(str(value).strip())
    except ValueError as exc:
        raise DrfValidationError({'date': 'Use YYYY-MM-DD for the date range.'}) from exc
    clock = time.max if end else time.min
    combined = datetime.combine(day, clock)
    if timezone.is_naive(combined):
        return timezone.make_aware(combined)
    return combined


def get_po_workflow(pk) -> PoWorkflow:
    return PoWorkflow.objects.select_related('company', 'opportunity', 'opportunity__company').get(pk=pk)


def _payload(*, customer_name: str, **fields) -> dict:
    errors = {}
    customer = (customer_name or '').strip()
    if not customer:
        errors['customer_name'] = 'Customer is required.'
    cleaned = {'customer_name': customer}
    for key, label in REQUIRED.items():
        if key == 'customer_name':
            continue
        value = str(fields.get(key) or '').strip()
        if not value:
            errors[key] = f'{label} is required.'
        cleaned[key] = value[: PoWorkflow._meta.get_field(key).max_length]
    if errors:
        raise DrfValidationError(errors)
    cleaned.update({
        'po_date': fields.get('po_date'),
        'start_date': fields.get('start_date'),
        'end_date': fields.get('end_date'),
        'expiry': fields.get('expiry'),
        'total_value': fields.get('total_value'),
        'value_per_invoice': fields.get('value_per_invoice'),
    })
    if 'opportunity' in fields:
        cleaned['opportunity'] = fields.get('opportunity')
    return cleaned


def _company(customer_name: str) -> Company:
    company, _ = Company.objects.get_or_create(name=customer_name)
    return company


def create_po_workflow(*, customer_name: str, **fields) -> PoWorkflow:
    payload = _payload(customer_name=customer_name, **fields)
    company = _company(payload['customer_name'])
    return PoWorkflow.objects.create(company=company, **payload)


def update_po_workflow(instance: PoWorkflow, *, customer_name: str | None = None, **fields) -> PoWorkflow:
    merged = {
        'billing_entity': fields.get('billing_entity', instance.billing_entity),
        'service_pillar': fields.get('service_pillar', instance.service_pillar),
        'po_number': fields.get('po_number', instance.po_number),
        'po_date': fields.get('po_date', instance.po_date) if 'po_date' in fields else instance.po_date,
        'agreement': fields.get('agreement', instance.agreement),
        'start_date': fields.get('start_date', instance.start_date) if 'start_date' in fields else instance.start_date,
        'end_date': fields.get('end_date', instance.end_date) if 'end_date' in fields else instance.end_date,
        'expiry': fields.get('expiry', instance.expiry) if 'expiry' in fields else instance.expiry,
        'total_value': fields.get('total_value', instance.total_value) if 'total_value' in fields else instance.total_value,
        'value_per_invoice': fields.get('value_per_invoice', instance.value_per_invoice)
        if 'value_per_invoice' in fields
        else instance.value_per_invoice,
        'billing_cycle': fields.get('billing_cycle', instance.billing_cycle),
        'billing_due': fields.get('billing_due', instance.billing_due),
    }
    if 'opportunity' in fields:
        merged['opportunity'] = fields.get('opportunity')
    payload = _payload(
        customer_name=customer_name if customer_name is not None else instance.customer_name,
        **merged,
    )
    instance.company = _company(payload['customer_name'])
    for key, value in payload.items():
        setattr(instance, key, value)
    instance.save()
    return instance

def delete_po_workflow(instance: PoWorkflow) -> None:
    instance.delete()


def approve_po_workflow(instance: PoWorkflow, *, user) -> PoWorkflow:
    """Upsert a finance PurchaseOrder and stamp approval on the workflow row."""
    from decimal import Decimal

    from django.utils import timezone

    from apps.finance.models import PurchaseOrder, PurchaseOrderStatus

    value = instance.total_value if instance.total_value is not None else Decimal('0')
    monthly = instance.value_per_invoice if instance.value_per_invoice is not None else Decimal('0')
    defaults = {
        'company': instance.company,
        'customer_name': instance.customer_name,
        'billing_entity': instance.billing_entity or '',
        'service_category': instance.service_pillar or '',
        'description': f'Approved from Deals PO workflow ({instance.agreement or "PO"})',
        'po_date': instance.po_date,
        'start_date': instance.start_date,
        'end_date': instance.end_date,
        'total_value': value,
        'monthly_billing': monthly,
        'billing_cycle': (instance.billing_cycle or '')[:40],
        'status': PurchaseOrderStatus.ACTIVE,
        'notes': f'Billing due: {instance.billing_due}' if instance.billing_due else '',
    }

    finance_po = instance.finance_purchase_order
    if finance_po is None:
        finance_po = PurchaseOrder.objects.filter(
            po_number=instance.po_number,
            customer_name=instance.customer_name,
        ).first()
    if finance_po is None:
        finance_po = PurchaseOrder.objects.create(po_number=instance.po_number, **defaults)
    else:
        for key, val in defaults.items():
            setattr(finance_po, key, val)
        finance_po.po_number = instance.po_number
        finance_po.save()

    instance.finance_purchase_order = finance_po
    instance.finance_approved_at = timezone.now()
    instance.finance_approved_by = user
    instance.save(
        update_fields=[
            'finance_purchase_order',
            'finance_approved_at',
            'finance_approved_by',
            'updated_at',
        ]
    )
    return instance


def export_po_xlsx() -> bytes:
    rows = [po_export_row(item) for item in list_po_workflows()]
    return build_po_workbook(rows, with_star_row=False)


def template_po_xlsx() -> bytes:
    return build_po_workbook(dummy_po_rows(), with_star_row=True, with_validation=True)


def import_po_xlsx(content: bytes) -> dict:
    workbook = open_upload(content)
    created = 0
    errors = []
    for excel_row, payload in load_po_rows_from_workbook(workbook):
        try:
            create_po_workflow(**payload)
            created += 1
        except DrfValidationError as exc:
            errors.append({'row': excel_row, 'message': _flatten_error(exc)})
    return {'created': created, 'errors': errors}


def _flatten_error(exc: DrfValidationError) -> str:
    detail = exc.detail
    if isinstance(detail, dict):
        parts = []
        for key, value in detail.items():
            if isinstance(value, list):
                parts.append(f'{key}: {value[0]}')
            else:
                parts.append(f'{key}: {value}')
        return '; '.join(parts)
    return str(detail)
