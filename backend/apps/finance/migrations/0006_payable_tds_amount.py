from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0005_compliance_items'),
    ]

    operations = [
        migrations.AddField(
            model_name='payable',
            name='tds_amount',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=15),
        ),
    ]
