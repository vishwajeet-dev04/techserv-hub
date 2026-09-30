from django.db import migrations, models


def event_to_milestone(apps, schema_editor):
    PoWorkflow = apps.get_model('deals', 'PoWorkflow')
    PurchaseOrder = apps.get_model('finance', 'PurchaseOrder')
    PoWorkflow.objects.filter(billing_cycle__iexact='Event').update(billing_cycle='Milestone')
    PurchaseOrder.objects.filter(billing_cycle__iexact='Event').update(billing_cycle='Milestone')


def milestone_to_event(apps, schema_editor):
    PoWorkflow = apps.get_model('deals', 'PoWorkflow')
    PurchaseOrder = apps.get_model('finance', 'PurchaseOrder')
    PoWorkflow.objects.filter(billing_cycle='Milestone').update(billing_cycle='Event')
    PurchaseOrder.objects.filter(billing_cycle='Milestone').update(billing_cycle='Event')


class Migration(migrations.Migration):

    dependencies = [
        ('deals', '0005_po_workflow_opportunity'),
        ('finance', '0011_payable_reminder_email_log'),
    ]

    operations = [
        migrations.AddField(
            model_name='poworkflow',
            name='milestone_details',
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.RunPython(event_to_milestone, milestone_to_event),
    ]
