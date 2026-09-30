from datetime import date
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.business.models import Company, CompanyStatus
from apps.finance.models import (
    CapitalEntry,
    CapitalType,
    CashflowBucket,
    CashflowDirection,
    CashflowEntry,
    Invoice,
    InvoiceStatus,
    Payable,
    PayableStatus,
    PurchaseOrder,
    PurchaseOrderStatus,
    payable_due_date,
)


def company(name: str, status=CompanyStatus.CUSTOMER) -> Company:
    obj, _ = Company.objects.get_or_create(
        name=name,
        defaults={'status': status, 'industry': 'Technology', 'notes': 'TechPay ledger account'},
    )
    return obj


class Command(BaseCommand):
    help = 'Load TechPay operational finance ledgers (POs, invoices, cashflow, payables, capital).'

    def handle(self, *args, **options):
        with transaction.atomic():
            self._seed()
        self.stdout.write(self.style.SUCCESS('TechPay finance ledgers loaded.'))

    def _seed(self):
        savex = company('Savex')
        chavans = company('Chavans Technologies', CompanyStatus.PARTNER)
        sunfinity = company('Sunfinity', CompanyStatus.PARTNER)
        new_era = company('New Era Informatique')
        red_baron = company('RED BARON INTEGRATED SERVICES')
        tangent = company('Tangent Ideas & Technologies')
        sprouts = company('Sprouts Software Technologies')
        veeam = company('Veeam')
        redington = company('Redington', CompanyStatus.PARTNER)
        galaxy = company('Galaxy', CompanyStatus.PARTNER)
        lenovo = company('Lenovo Enterprise')

        pos = [
            ('PO-VEE-001', veeam, 'Veeam', 'Marketing', date(2026, 1, 10), Decimal('4400000'), Decimal('440000')),
            ('PO-SAV-002', savex, 'Savex', 'Consulting', date(2026, 2, 1), Decimal('3600000'), Decimal('300000')),
            ('PO-LEN-003', lenovo, 'Lenovo Enterprise', 'Marketing', date(2026, 3, 15), Decimal('4275000'), Decimal('355000')),
            ('PO-RED-004', redington, 'Redington', 'Marketing COE', date(2026, 4, 8), Decimal('8500000'), Decimal('425000')),
            ('PO-GAL-005', galaxy, 'Galaxy', 'BizOps', date(2026, 5, 2), Decimal('2100000'), Decimal('175000')),
            ('PO-CHV-006', chavans, 'Chavans Technologies', 'Sprouts', date(2026, 6, 12), Decimal('1850000'), Decimal('154000')),
            ('PO-SUN-007', sunfinity, 'Sunfinity', 'Channel', date(2026, 6, 20), Decimal('1620000'), Decimal('135000')),
            ('PO-RBI-008', red_baron, 'RED BARON INTEGRATED SERVICES', 'Software Development', date(2025, 8, 1), Decimal('9800000'), Decimal('280000')),
            ('PO-TNG-009', tangent, 'Tangent Ideas & Technologies', 'Software Development', date(2025, 9, 15), Decimal('3280421'), Decimal('120000')),
            ('PO-SPR-010', sprouts, 'Sprouts Software Technologies', 'Platform', date(2025, 11, 3), Decimal('2175000'), Decimal('150000')),
        ]
        po_map = {}
        for number, firm, customer, category, po_date, value, monthly in pos:
            obj, _ = PurchaseOrder.objects.update_or_create(
                po_number=number,
                defaults={
                    'company': firm,
                    'customer_name': customer,
                    'billing_entity': customer,
                    'service_category': category,
                    'po_date': po_date,
                    'start_date': po_date,
                    'total_value': value,
                    'monthly_billing': monthly,
                    'billing_cycle': 'Monthly',
                    'status': PurchaseOrderStatus.ACTIVE,
                },
            )
            po_map[number] = obj

        invoices = [
            ('INV-1042', po_map['PO-CHV-006'], chavans, 'Chavans Technologies', Decimal('612000'), Decimal('0'), date(2026, 8, 26), date(2026, 8, 26), InvoiceStatus.SENT),
            ('INV-1043', po_map['PO-SUN-007'], sunfinity, 'Sunfinity Technology Solutions', Decimal('524124'), Decimal('0'), date(2026, 8, 27), date(2026, 8, 27), InvoiceStatus.SENT),
            ('INV-1038', po_map['PO-SAV-002'], savex, 'Savex Technologies', Decimal('210158'), Decimal('0'), date(2026, 8, 10), date(2026, 8, 10), InvoiceStatus.SENT),
            ('INV-1031', po_map['PO-CHV-006'], chavans, 'New Era Informatique', Decimal('400000'), Decimal('0'), date(2026, 8, 28), date(2026, 8, 28), InvoiceStatus.SENT),
            ('INV-0881', po_map['PO-RBI-008'], red_baron, 'RED BARON INTEGRATED SERVICES', Decimal('2810392.23'), Decimal('0'), date(2025, 8, 18), date(2025, 9, 17), InvoiceStatus.OVERDUE),
            ('INV-0912', po_map['PO-TNG-009'], tangent, 'Tangent Ideas & Technologies', Decimal('1200000'), Decimal('0'), date(2025, 9, 22), date(2025, 10, 22), InvoiceStatus.OVERDUE),
            ('INV-0960', po_map['PO-SPR-010'], sprouts, 'Sprouts Software Technologies', Decimal('1000000'), Decimal('0'), date(2025, 11, 12), date(2025, 12, 12), InvoiceStatus.OVERDUE),
            ('INV-1001', po_map['PO-VEE-001'], veeam, 'Veeam', Decimal('1760000'), Decimal('1760000'), date(2026, 4, 1), date(2026, 4, 30), InvoiceStatus.PAID),
            ('INV-1010', po_map['PO-RED-004'], redington, 'Redington', Decimal('2800000'), Decimal('2800000'), date(2026, 5, 15), date(2026, 6, 14), InvoiceStatus.PAID),
            ('INV-1020', po_map['PO-LEN-003'], lenovo, 'Lenovo Enterprise', Decimal('2048065'), Decimal('2048065'), date(2026, 6, 1), date(2026, 6, 30), InvoiceStatus.PAID),
        ]
        for number, po, firm, customer, amount, received, inv_date, due, status in invoices:
            Invoice.objects.update_or_create(
                invoice_number=number,
                defaults={
                    'purchase_order': po,
                    'company': firm,
                    'customer_name': customer,
                    'amount': amount,
                    'amount_received': received,
                    'invoice_date': inv_date,
                    'due_date': due,
                    'received_date': due if received else None,
                    'status': status,
                },
            )

        payables = [
            ('AWS India', 'Subscriptions', 'AWS-0826', Decimal('186000'), date(2026, 8, 20)),
            ('WeWork', 'Office Rent', 'WW-0726', Decimal('245000'), date(2026, 8, 5)),
            ('Deloitte', 'Professional Charges', 'DEL-Q1', Decimal('320000'), date(2026, 8, 28)),
            ('Indigo', 'Travel - Flights', 'IND-0618', Decimal('84200'), date(2026, 7, 30)),
        ]
        for vendor, category, number, amount, invoice_date in payables:
            Payable.objects.update_or_create(
                invoice_number=number,
                defaults={
                    'vendor': vendor,
                    'category': category,
                    'month_label': 'Aug 2026',
                    'taxable_amount': (amount / Decimal('1.18')).quantize(Decimal('0.01')),
                    'gst_amount': (amount - amount / Decimal('1.18')).quantize(Decimal('0.01')),
                    'total_amount': amount,
                    'payable_amount': amount,
                    'invoice_date': invoice_date,
                    'due_date': payable_due_date(invoice_date),
                    'status': PayableStatus.PENDING,
                },
            )

        cash = [
            (date(2026, 8, 4), CashflowDirection.INFLOW, CashflowBucket.REVENUE, 'Customer Receipts', 'Veeam', Decimal('1760000')),
            (date(2026, 8, 12), CashflowDirection.INFLOW, CashflowBucket.REVENUE, 'Customer Receipts', 'Redington', Decimal('1400000')),
            (date(2026, 8, 18), CashflowDirection.INFLOW, CashflowBucket.CAPITAL, 'Investment Received', 'Seed fund', Decimal('2500000')),
            (date(2026, 8, 6), CashflowDirection.OUTFLOW, CashflowBucket.OPERATING, 'Professional Charges', 'Deloitte', Decimal('320000')),
            (date(2026, 8, 8), CashflowDirection.OUTFLOW, CashflowBucket.OPERATING, 'Office Rent', 'WeWork', Decimal('245000')),
            (date(2026, 8, 15), CashflowDirection.OUTFLOW, CashflowBucket.OPERATING, 'Subscriptions', 'AWS India', Decimal('186000')),
            (date(2026, 8, 22), CashflowDirection.OUTFLOW, CashflowBucket.CAPITAL, 'Loan Repayment', 'HDFC', Decimal('450000')),
        ]
        for entry_date, direction, bucket, category, entity, amount in cash:
            CashflowEntry.objects.update_or_create(
                entry_date=entry_date,
                category=category,
                entity=entity,
                defaults={
                    'direction': direction,
                    'bucket': bucket,
                    'amount': amount,
                },
            )

        capital = [
            (CapitalType.INVESTMENT_RECEIVED, 'Founders / Seed', Decimal('7500000'), date(2025, 6, 1)),
            (CapitalType.INVESTMENT_MADE, 'Sprouts.ai', Decimal('1200000'), date(2026, 2, 14)),
            (CapitalType.LOAN_PROVIDED, 'Group entity', Decimal('500000'), date(2026, 4, 10)),
            (CapitalType.LOAN_TAKEN, 'HDFC CC', Decimal('1800000'), date(2025, 12, 1)),
        ]
        for ctype, party, amount, when in capital:
            CapitalEntry.objects.update_or_create(
                capital_type=ctype,
                counterparty=party,
                defaults={'amount': amount, 'entry_date': when, 'status': 'Active'},
            )
