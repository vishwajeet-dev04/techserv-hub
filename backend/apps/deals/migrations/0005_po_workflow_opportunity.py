import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('deals', '0004_po_workflow_finance_approve'),
        ('pulse', '0008_activity_attachments'),
    ]

    operations = [
        migrations.AddField(
            model_name='poworkflow',
            name='opportunity',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='po_workflows',
                to='pulse.opportunity',
            ),
        ),
    ]
