from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('pulse', '0006_pipeline_overhaul'),
    ]

    operations = [
        migrations.AlterField(
            model_name='opportunity',
            name='stage',
            field=models.CharField(db_index=True, default='Prospect', max_length=40),
        ),
    ]
