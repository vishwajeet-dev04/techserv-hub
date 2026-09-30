from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0008_backfill_master_data'),
    ]

    operations = [
        migrations.AddField(
            model_name='cashflowentry',
            name='account',
            field=models.CharField(
                choices=[('CURRENT', 'Current / Operational'), ('SEED', 'Seed Account')],
                db_index=True,
                default='CURRENT',
                max_length=10,
            ),
        ),
    ]
