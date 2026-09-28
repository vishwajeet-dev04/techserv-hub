from django.db import migrations


def clear_pulse_pipeline(apps, schema_editor):
    Reminder = apps.get_model('pulse', 'Reminder')
    Opportunity = apps.get_model('pulse', 'Opportunity')
    Reminder.objects.all().delete()
    Opportunity.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ('pulse', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(clear_pulse_pipeline, migrations.RunPython.noop),
    ]
