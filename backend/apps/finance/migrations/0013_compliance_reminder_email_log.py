import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0012_invoice_due_date_and_reminder_log'),
    ]

    operations = [
        migrations.CreateModel(
            name='ComplianceReminderEmailLog',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('offset_days', models.PositiveSmallIntegerField()),
                ('due_date', models.DateField()),
                ('recipient_email', models.EmailField()),
                ('sent_at', models.DateTimeField(auto_now_add=True)),
                (
                    'compliance_item',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='reminder_email_logs',
                        to='finance.complianceitem',
                    ),
                ),
            ],
            options={
                'db_table': 'compliance_reminder_email_logs',
                'ordering': ['-sent_at'],
                'constraints': [
                    models.UniqueConstraint(
                        fields=('compliance_item', 'offset_days', 'due_date', 'recipient_email'),
                        name='uniq_compliance_reminder_email_log',
                    ),
                    models.CheckConstraint(
                        condition=models.Q(offset_days__in=[1, 3]),
                        name='compliance_reminder_email_offset_days_valid',
                    ),
                ],
            },
        ),
    ]
