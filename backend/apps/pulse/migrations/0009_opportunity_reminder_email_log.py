# Generated manually for opportunity date reminder emails

from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('pulse', '0008_activity_attachments'),
    ]

    operations = [
        migrations.CreateModel(
            name='OpportunityReminderEmailLog',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('reminder_kind', models.CharField(
                    choices=[('FOLLOW_UP', 'Follow Up'), ('CLOSE', 'Close Date')],
                    db_index=True,
                    max_length=20,
                )),
                ('offset_days', models.PositiveSmallIntegerField()),
                ('target_date', models.DateField()),
                ('recipient_email', models.EmailField(max_length=254)),
                ('sent_at', models.DateTimeField(auto_now_add=True)),
                ('opportunity', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='reminder_email_logs',
                    to='pulse.opportunity',
                )),
            ],
            options={
                'db_table': 'pulse_opportunity_reminder_email_logs',
                'ordering': ['-sent_at'],
            },
        ),
        migrations.AddConstraint(
            model_name='opportunityreminderemaillog',
            constraint=models.UniqueConstraint(
                fields=('opportunity', 'reminder_kind', 'offset_days', 'target_date'),
                name='uniq_opp_reminder_email_log',
            ),
        ),
        migrations.AddConstraint(
            model_name='opportunityreminderemaillog',
            constraint=models.CheckConstraint(
                condition=models.Q(offset_days__in=[1, 3]),
                name='opp_reminder_email_offset_days_valid',
            ),
        ),
    ]
