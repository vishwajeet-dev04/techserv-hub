import uuid
from datetime import timedelta

import django.db.models.deletion
from django.db import migrations, models

PAYABLE_TERMS_DAYS = 30


def fill_blank_invoice_due_dates(apps, schema_editor):
    Invoice = apps.get_model('finance', 'Invoice')
    for invoice in Invoice.objects.filter(due_date__isnull=True).exclude(invoice_date__isnull=True).iterator():
        invoice.due_date = invoice.invoice_date + timedelta(days=PAYABLE_TERMS_DAYS)
        invoice.save(update_fields=['due_date'])


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0011_payable_reminder_email_log'),
    ]

    operations = [
        migrations.RunPython(fill_blank_invoice_due_dates, migrations.RunPython.noop),
        migrations.CreateModel(
            name='InvoiceReminderEmailLog',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('offset_days', models.PositiveSmallIntegerField()),
                ('due_date', models.DateField()),
                ('recipients', models.TextField(blank=True)),
                ('sent_at', models.DateTimeField(auto_now_add=True)),
                (
                    'invoice',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='reminder_email_logs',
                        to='finance.invoice',
                    ),
                ),
            ],
            options={
                'db_table': 'invoice_reminder_email_logs',
                'ordering': ['-sent_at'],
                'constraints': [
                    models.UniqueConstraint(
                        fields=('invoice', 'offset_days', 'due_date'),
                        name='uniq_invoice_reminder_email_log',
                    ),
                    models.CheckConstraint(
                        condition=models.Q(offset_days__in=[1, 3]),
                        name='invoice_reminder_email_offset_days_valid',
                    ),
                ],
            },
        ),
    ]
