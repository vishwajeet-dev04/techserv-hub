from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


STAGE_MAP = {
    'Prospect': 'Qualify',
    'Prospect Qualification': 'Qualify',
    'Lead Generation': 'Qualify',
    'Lead Qualification': 'Qualify',
    'Assign': 'Qualify',
    'First Contact': 'Qualify',
    'Approach or Demo': 'Approach',
    'Discovery Meeting': 'Approach',
    'Converted': 'Commercial',
    'Commercial Prospect': 'Commercial',
    'Commercial Proposal': 'Commercial',
    'Negotiation': 'Negotiation',
    'Win': 'Win',
    'Closed': 'Win',
    'Lost': 'Lost',
    'Cancelled': 'Cancelled',
    'Cancel': 'Cancelled',
}

KEEP = {
    'Qualify',
    'Approach',
    'Demo',
    'Commercial',
    'Negotiation',
    'Win',
    'Lost',
    'Cancelled',
}


def remap_stages(apps, schema_editor):
    Opportunity = apps.get_model('pulse', 'Opportunity')
    for row in Opportunity.objects.all().only('id', 'stage'):
        next_stage = STAGE_MAP.get(row.stage, row.stage)
        if next_stage not in KEEP:
            next_stage = 'Qualify'
        if next_stage != row.stage:
            Opportunity.objects.filter(pk=row.pk).update(stage=next_stage)


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('pulse', '0005_remap_sales_stages'),
    ]

    operations = [
        migrations.AddField(
            model_name='opportunity',
            name='currency',
            field=models.CharField(default='INR', max_length=8),
        ),
        migrations.AlterField(
            model_name='opportunity',
            name='stage',
            field=models.CharField(db_index=True, default='Qualify', max_length=40),
        ),
        migrations.RunPython(remap_stages, migrations.RunPython.noop),
        migrations.CreateModel(
            name='OpportunityActivity',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('action', models.CharField(choices=[('STAGE_CHANGE', 'Stage Change'), ('NOTE', 'Note'), ('FIELD_UPDATE', 'Field Update')], max_length=20)),
                ('from_stage', models.CharField(blank=True, max_length=40)),
                ('to_stage', models.CharField(blank=True, max_length=40)),
                ('note', models.TextField(blank=True)),
                ('follow_up_date', models.DateField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('actor', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='pulse_opportunity_activities', to=settings.AUTH_USER_MODEL)),
                ('opportunity', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='activities', to='pulse.opportunity')),
            ],
            options={
                'db_table': 'pulse_opportunity_activities',
                'ordering': ['-created_at'],
            },
        ),
    ]
