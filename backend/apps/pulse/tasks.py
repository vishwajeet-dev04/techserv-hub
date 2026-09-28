from celery import shared_task

from apps.pulse.services import pulse_service


@shared_task(name='pulse.send_opportunity_date_reminders')
def send_opportunity_date_reminders_task():
    result = pulse_service.send_due_opportunity_date_reminders()
    return {
        'sent': result.sent,
        'skipped': result.skipped,
        'failed': result.failed,
    }
