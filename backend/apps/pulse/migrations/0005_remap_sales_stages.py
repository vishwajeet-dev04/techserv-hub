from django.db import migrations, models

STAGE_MAP = {
    'Lead Generation': 'Prospect',
    'Lead Qualification': 'Prospect Qualification',
    'Assign': 'Prospect Qualification',
    'First Contact': 'Prospect Qualification',
    'Discovery Meeting': 'Approach or Demo',
    'Approach or Demo': 'Approach or Demo',
    'Commercial Proposal': 'Commercial Prospect',
    'Cancel': 'Cancelled',
}

KEEP = {
    'Prospect',
    'Prospect Qualification',
    'Approach or Demo',
    'Converted',
    'Commercial Prospect',
    'Negotiation',
    'Win',
    'Lost',
    'Cancelled',
    'Closed',
}


def remap_stages(apps, schema_editor):
    Opportunity = apps.get_model('pulse', 'Opportunity')
    for row in Opportunity.objects.all().only('id', 'stage'):
        next_stage = STAGE_MAP.get(row.stage, row.stage)
        if next_stage not in KEEP:
            next_stage = 'Prospect'
        if next_stage != row.stage:
            Opportunity.objects.filter(pk=row.pk).update(stage=next_stage)


class Migration(migrations.Migration):
    dependencies = [
        ('pulse', '0004_alter_opportunity_prospect_number'),
    ]

    operations = [
        migrations.AlterField(
            model_name='opportunity',
            name='stage',
            field=models.CharField(db_index=True, default='Prospect', max_length=40),
        ),
        migrations.RunPython(remap_stages, migrations.RunPython.noop),
    ]
