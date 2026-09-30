import re

from django.db import migrations
from django.db.models import Q

GSTIN_RE = re.compile(r'^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$')


def _tax_ids(raw):
    gstin = (raw or '').strip().upper()
    if not GSTIN_RE.match(gstin):
        return '', ''
    return gstin, gstin[2:12]


def backfill(apps, schema_editor):
    Company = apps.get_model('business', 'Company')
    Invoice = apps.get_model('finance', 'Invoice')
    Payable = apps.get_model('finance', 'Payable')
    PurchaseOrder = apps.get_model('finance', 'PurchaseOrder')
    FinanceClient = apps.get_model('finance', 'FinanceClient')
    FinanceVendor = apps.get_model('finance', 'FinanceVendor')

    known = {name.lower() for name in FinanceClient.objects.values_list('name', flat=True)}
    companies = Company.objects.filter(
        Q(invoices__isnull=False) | Q(purchase_orders__isnull=False)
    ).distinct()
    for company in companies:
        name = (company.name or '').strip()
        if not name or name.lower() in known:
            continue
        known.add(name.lower())
        gstin, pan = _tax_ids(company.gst_number)
        service = (
            PurchaseOrder.objects.filter(company=company)
            .exclude(service_category='')
            .values_list('service_category', flat=True)
            .first()
        ) or ''
        FinanceClient.objects.create(
            name=name,
            company=company,
            gstin=gstin,
            pan=pan,
            service_line=service,
        )

    customer_names = Invoice.objects.filter(company__isnull=True).values_list('customer_name', flat=True).distinct()
    for raw in customer_names:
        name = (raw or '').strip()
        if not name or name.lower() in known:
            continue
        known.add(name.lower())
        FinanceClient.objects.create(name=name)

    vendor_known = {name.lower() for name in FinanceVendor.objects.values_list('name', flat=True)}
    for raw in Payable.objects.values_list('vendor', flat=True).distinct():
        name = (raw or '').strip()
        if not name or name.lower() in vendor_known:
            continue
        vendor_known.add(name.lower())
        FinanceVendor.objects.create(name=name)


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0007_master_data'),
    ]

    operations = [
        migrations.RunPython(backfill, migrations.RunPython.noop),
    ]
