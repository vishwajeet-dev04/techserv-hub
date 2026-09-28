from datetime import date

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.finance.models import ComplianceItem, ComplianceStatus
from apps.finance.management.commands._fy2627_rows import FY2627_ROWS


class Command(BaseCommand):
    help = 'Upsert Compliance Calendar rows for FY 2026-27 from the finance reference calendar.'

    def handle(self, *args, **options):
        created = 0
        updated = 0
        with transaction.atomic():
            for period_month, title, form_name, applicable_act, due_date, due_date_note in FY2627_ROWS:
                pm = date.fromisoformat(period_month)
                dd = date.fromisoformat(due_date) if due_date else None
                lookup = {
                    'title': title,
                    'form_name': form_name,
                    'period_month': pm,
                }
                defaults = {
                    'applicable_act': applicable_act,
                    'due_date': dd,
                    'due_date_note': due_date_note or '',
                    'status': ComplianceStatus.PENDING,
                }
                obj, was_created = ComplianceItem.objects.update_or_create(
                    **lookup,
                    defaults=defaults,
                )
                if was_created:
                    created += 1
                else:
                    updated += 1
        self.stdout.write(
            self.style.SUCCESS(
                f'Compliance FY 2026-27 seeded: {created} created, {updated} updated '
                f'({len(FY2627_ROWS)} rows).'
            )
        )
