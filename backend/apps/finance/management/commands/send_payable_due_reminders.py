from datetime import date

from django.core.management.base import BaseCommand, CommandError

from apps.finance.payable_reminders import send_payable_due_reminders


class Command(BaseCommand):
    help = 'Email Finance and Admin users about pending payables due in 3 days and 1 day.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--as-of',
            dest='as_of',
            default=None,
            help='Run as if today is this date (YYYY-MM-DD). Defaults to local today.',
        )

    def handle(self, *args, **options):
        as_of = options.get('as_of')
        as_of_date = None
        if as_of:
            try:
                as_of_date = date.fromisoformat(as_of)
            except ValueError as exc:
                raise CommandError('Invalid --as-of date. Use YYYY-MM-DD.') from exc

        result = send_payable_due_reminders(as_of_date=as_of_date)
        self.stdout.write(
            self.style.SUCCESS(
                f'Payable reminders complete: sent={result.sent} skipped={result.skipped} failed={result.failed}'
            )
        )
