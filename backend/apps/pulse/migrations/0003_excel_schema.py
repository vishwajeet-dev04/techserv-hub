# Generated manually for Excel-aligned Pulse schema

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('pulse', '0002_clear_pipeline'),
    ]

    operations = [
        migrations.AddField(
            model_name='pulsecontact',
            name='address_1',
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name='pulsecontact',
            name='city',
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.AddField(
            model_name='pulsecontact',
            name='company_email',
            field=models.EmailField(blank=True, max_length=254),
        ),
        migrations.AddField(
            model_name='pulsecontact',
            name='country',
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.AddField(
            model_name='pulsecontact',
            name='gst_number',
            field=models.CharField(blank=True, max_length=40),
        ),
        migrations.AddField(
            model_name='pulsecontact',
            name='state',
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.RemoveField(
            model_name='pulsecontact',
            name='comments',
        ),
        migrations.RemoveField(
            model_name='pulsecontact',
            name='location',
        ),
        migrations.AddField(
            model_name='opportunity',
            name='department',
            field=models.CharField(blank=True, max_length=150),
        ),
        migrations.AddField(
            model_name='opportunity',
            name='delivery_partner',
            field=models.CharField(blank=True, max_length=150),
        ),
        migrations.AddField(
            model_name='opportunity',
            name='lead_source',
            field=models.CharField(blank=True, max_length=150),
        ),
        migrations.AddField(
            model_name='opportunity',
            name='prospect_number',
            field=models.CharField(max_length=32, unique=True),
        ),
        migrations.AddField(
            model_name='opportunity',
            name='contact',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name='opportunities',
                to='pulse.pulsecontact',
            ),
        ),
        migrations.AlterField(
            model_name='opportunity',
            name='stage',
            field=models.CharField(db_index=True, default='Lead Generation', max_length=40),
        ),
        migrations.AlterField(
            model_name='opportunity',
            name='status',
            field=models.CharField(
                choices=[('OPEN', 'Open'), ('WON', 'Won'), ('LOST', 'Lost')],
                db_index=True,
                default='OPEN',
                max_length=20,
            ),
        ),
        migrations.RemoveField(
            model_name='opportunity',
            name='closed_date',
        ),
        migrations.RemoveField(
            model_name='opportunity',
            name='currency',
        ),
        migrations.RemoveField(
            model_name='opportunity',
            name='final_amount',
        ),
    ]
