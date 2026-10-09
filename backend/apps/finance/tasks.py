from celery import shared_task

from apps.finance.compliance_reminders import send_compliance_due_reminders
from apps.finance.invoice_reminders import send_invoice_due_reminders
from apps.finance.payable_reminders import send_payable_due_reminders


@shared_task(name='finance.send_payable_due_reminders')
def send_payable_due_reminders_task():
    result = send_payable_due_reminders()
    return {
        'sent': result.sent,
        'skipped': result.skipped,
        'failed': result.failed,
    }


@shared_task(name='finance.send_invoice_due_reminders')
def send_invoice_due_reminders_task():
    result = send_invoice_due_reminders()
    return {
        'sent': result.sent,
        'skipped': result.skipped,
        'failed': result.failed,
    }


@shared_task(name='finance.send_compliance_due_reminders')
def send_compliance_due_reminders_task():
    result = send_compliance_due_reminders()
    return {
        'sent': result.sent,
        'skipped': result.skipped,
        'failed': result.failed,
    }
