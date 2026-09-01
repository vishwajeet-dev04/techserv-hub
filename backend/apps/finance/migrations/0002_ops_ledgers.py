import django.db.models.deletion
import uuid
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('business', '0001_initial'),
        ('finance', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='PurchaseOrder',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('po_number', models.CharField(db_index=True, max_length=80)),
                ('customer_name', models.CharField(max_length=255)),
                ('billing_entity', models.CharField(blank=True, max_length=255)),
                ('service_category', models.CharField(blank=True, max_length=150)),
                ('description', models.TextField(blank=True)),
                ('po_date', models.DateField(blank=True, null=True)),
                ('start_date', models.DateField(blank=True, null=True)),
                ('end_date', models.DateField(blank=True, null=True)),
                ('total_value', models.DecimalField(decimal_places=2, max_digits=15)),
                ('monthly_billing', models.DecimalField(decimal_places=2, default=0, max_digits=15)),
                ('billing_cycle', models.CharField(blank=True, max_length=40)),
                ('status', models.CharField(choices=[('ACTIVE', 'Active'), ('COMPLETED', 'Completed'), ('CANCELLED', 'Cancelled')], db_index=True, default='ACTIVE', max_length=20)),
                ('notes', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('company', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='purchase_orders', to='business.company')),
            ],
            options={'db_table': 'purchase_orders', 'ordering': ['-po_date', '-created_at']},
        ),
        migrations.CreateModel(
            name='Invoice',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('invoice_number', models.CharField(db_index=True, max_length=80)),
                ('customer_name', models.CharField(max_length=255)),
                ('amount', models.DecimalField(decimal_places=2, max_digits=15)),
                ('amount_received', models.DecimalField(decimal_places=2, default=0, max_digits=15)),
                ('invoice_date', models.DateField()),
                ('due_date', models.DateField(blank=True, null=True)),
                ('received_date', models.DateField(blank=True, null=True)),
                ('status', models.CharField(choices=[('DRAFT', 'Draft'), ('SENT', 'Invoice Sent'), ('PARTIAL', 'Partial'), ('PAID', 'Paid'), ('OVERDUE', 'Overdue')], db_index=True, default='SENT', max_length=20)),
                ('notes', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('company', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='invoices', to='business.company')),
                ('purchase_order', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='invoices', to='finance.purchaseorder')),
            ],
            options={'db_table': 'invoices', 'ordering': ['-invoice_date', '-created_at']},
        ),
        migrations.CreateModel(
            name='Payable',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('vendor', models.CharField(db_index=True, max_length=255)),
                ('category', models.CharField(blank=True, max_length=100)),
                ('invoice_number', models.CharField(blank=True, max_length=80)),
                ('month_label', models.CharField(blank=True, max_length=20)),
                ('taxable_amount', models.DecimalField(decimal_places=2, default=0, max_digits=15)),
                ('gst_amount', models.DecimalField(decimal_places=2, default=0, max_digits=15)),
                ('total_amount', models.DecimalField(decimal_places=2, max_digits=15)),
                ('payable_amount', models.DecimalField(decimal_places=2, max_digits=15)),
                ('due_date', models.DateField(blank=True, null=True)),
                ('status', models.CharField(choices=[('PENDING', 'Pending'), ('PAID', 'Paid')], db_index=True, default='PENDING', max_length=20)),
                ('notes', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={'db_table': 'payables', 'ordering': ['-due_date', '-created_at']},
        ),
        migrations.CreateModel(
            name='CashflowEntry',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('entry_date', models.DateField(db_index=True)),
                ('direction', models.CharField(choices=[('INFLOW', 'Inflow'), ('OUTFLOW', 'Outflow')], max_length=10)),
                ('bucket', models.CharField(choices=[('REVENUE', 'Revenue'), ('CAPITAL', 'Capital'), ('OPERATING', 'Operating')], default='OPERATING', max_length=20)),
                ('category', models.CharField(max_length=100)),
                ('entity', models.CharField(blank=True, max_length=255)),
                ('amount', models.DecimalField(decimal_places=2, max_digits=15)),
                ('notes', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={'db_table': 'cashflow_entries', 'ordering': ['-entry_date', '-created_at']},
        ),
        migrations.CreateModel(
            name='CapitalEntry',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('capital_type', models.CharField(choices=[('INVESTMENT_RECEIVED', 'Investments Received'), ('INVESTMENT_MADE', 'Investments Made'), ('LOAN_PROVIDED', 'Loans Provided'), ('LOAN_TAKEN', 'Loans Taken')], db_index=True, max_length=30)),
                ('counterparty', models.CharField(max_length=255)),
                ('amount', models.DecimalField(decimal_places=2, max_digits=15)),
                ('entry_date', models.DateField()),
                ('status', models.CharField(default='Active', max_length=40)),
                ('notes', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={'db_table': 'capital_entries', 'ordering': ['-entry_date', '-created_at']},
        ),
    ]
