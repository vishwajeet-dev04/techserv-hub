from datetime import date

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.finance.models import ComplianceItem, ComplianceStatus
from apps.finance.management.commands._fy2627_rows import FY2627_ROWS
from apps.finance.workspace import COMPANIES, DEFAULT_COMPANY, DEFAULT_REGION, REGIONS


class Command(BaseCommand):
    help = 'Upsert Compliance Calendar rows for FY 2026-27 from the finance reference calendar.'

    def add_arguments(self, parser):
        parser.add_argument('--company', default=DEFAULT_COMPANY, help=f'One of: {", ".join(sorted(COMPANIES))}')
        parser.add_argument('--region', default=DEFAULT_REGION, help=f'One of: {", ".join(sorted(REGIONS))}')

    def handle(self, *args, **options):
        company = options['company'].strip().lower()
        region = options['region'].strip().lower()
        if company not in COMPANIES:
            raise CommandError(f'Unknown company "{company}". Use one of: {", ".join(sorted(COMPANIES))}.')
        if region not in REGIONS:
            raise CommandError(f'Unknown region "{region}". Use one of: {", ".join(sorted(REGIONS))}.')

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
                    'workspace_company': company,
                    'workspace_region': region,
                }
                defaults = {
                    'applicable_act': applicable_act,
                    'due_date': dd,
                    'due_date_note': due_date_note or '',
                }
                _, was_created = ComplianceItem.objects.update_or_create(
                    **lookup,
                    defaults=defaults,
                    create_defaults={**defaults, 'status': ComplianceStatus.PENDING},
                )
                if was_created:
                    created += 1
                else:
                    updated += 1
        self.stdout.write(
            self.style.SUCCESS(
                f'Compliance FY 2026-27 seeded for {company}/{region}: {created} created, {updated} updated '
                f'({len(FY2627_ROWS)} rows).'
            )
        )
