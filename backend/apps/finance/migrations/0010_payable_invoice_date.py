from datetime import timedelta

from django.db import migrations, models

PAYABLE_TERMS_DAYS = 30


def move_due_to_invoice_date(apps, schema_editor):
    """Old `due_date` held the supplier invoice date; the real due date is 30 days later."""
    Payable = apps.get_model('finance', 'Payable')
    for payable in Payable.objects.filter(due_date__isnull=False, invoice_date__isnull=True).iterator():
        payable.invoice_date = payable.due_date
        payable.due_date = payable.due_date + timedelta(days=PAYABLE_TERMS_DAYS)
        payable.save(update_fields=['invoice_date', 'due_date'])


def restore_due_from_invoice_date(apps, schema_editor):
    Payable = apps.get_model('finance', 'Payable')
    for payable in Payable.objects.filter(invoice_date__isnull=False).iterator():
        payable.due_date = payable.invoice_date
        payable.invoice_date = None
        payable.save(update_fields=['invoice_date', 'due_date'])


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0009_cashflow_account'),
    ]

    operations = [
        migrations.AddField(
            model_name='payable',
            name='invoice_date',
            field=models.DateField(blank=True, db_index=True, null=True),
        ),
        migrations.AlterModelOptions(
            name='payable',
            options={'ordering': ['-invoice_date', '-created_at']},
        ),
        migrations.RunPython(move_due_to_invoice_date, restore_due_from_invoice_date),
    ]
