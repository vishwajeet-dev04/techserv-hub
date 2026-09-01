from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('deals', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='deal',
            name='service_pillar',
            field=models.CharField(blank=True, db_index=True, max_length=100),
        ),
        migrations.AddField(
            model_name='deal',
            name='sub_category',
            field=models.CharField(blank=True, max_length=150),
        ),
    ]
