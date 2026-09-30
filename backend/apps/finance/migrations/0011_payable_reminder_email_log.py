import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0010_payable_invoice_date'),
    ]

    operations = [
        migrations.CreateModel(
            name='PayableReminderEmailLog',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('offset_days', models.PositiveSmallIntegerField()),
                ('due_date', models.DateField()),
                ('recipients', models.TextField(blank=True)),
                ('sent_at', models.DateTimeField(auto_now_add=True)),
                (
                    'payable',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='reminder_email_logs',
                        to='finance.payable',
                    ),
                ),
            ],
            options={
                'db_table': 'payable_reminder_email_logs',
                'ordering': ['-sent_at'],
                'constraints': [
                    models.UniqueConstraint(
                        fields=('payable', 'offset_days', 'due_date'),
                        name='uniq_payable_reminder_email_log',
                    ),
                    models.CheckConstraint(
                        condition=models.Q(offset_days__in=[1, 3]),
                        name='payable_reminder_email_offset_days_valid',
                    ),
                ],
            },
        ),
    ]
