from celery import shared_task

from apps.deals.po_issue_emails import send_po_issue_email, send_po_issue_resolved_email


@shared_task(name='deals.send_po_issue_email')
def send_po_issue_email_task(issue_id: str):
    return send_po_issue_email(issue_id)


@shared_task(name='deals.send_po_issue_resolved_email')
def send_po_issue_resolved_email_task(issue_id: str):
    return send_po_issue_resolved_email(issue_id)
