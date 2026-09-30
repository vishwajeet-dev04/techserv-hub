from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('pulse', '0009_opportunity_reminder_email_log'),
    ]

    operations = [
        migrations.AlterField(
            model_name='opportunityactivity',
            name='action',
            field=models.CharField(
                choices=[
                    ('STAGE_CHANGE', 'Stage Change'),
                    ('FOLLOW_UP_CHANGE', 'Follow-up Change'),
                    ('NOTE', 'Note'),
                    ('FIELD_UPDATE', 'Field Update'),
                ],
                max_length=20,
            ),
        ),
    ]
