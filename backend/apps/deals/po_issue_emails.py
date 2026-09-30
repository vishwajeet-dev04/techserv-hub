"""Emails for PO document issues raised by Ops on Win opportunities."""

from __future__ import annotations

import logging

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

from apps.deals.models import PoDocumentIssue
from apps.deals.po_constants import PO_ISSUE_REASONS
from apps.users.models import User, UserRole

logger = logging.getLogger(__name__)

RECIPIENT_ROLES = (UserRole.ADMIN, UserRole.MANAGEMENT)


def _from_email() -> str:
    return getattr(settings, 'DEFAULT_FROM_EMAIL', None) or 'noreply@techserv.local'


def _opportunities_link() -> str:
    base = (getattr(settings, 'FRONTEND_URL', '') or '').rstrip('/')
    return f'{base}/pulse/opportunities' if base else ''


def _clean(emails) -> list[str]:
    return list(dict.fromkeys(email.strip() for email in emails if email and email.strip()))


def issue_recipients(issue: PoDocumentIssue) -> list[str]:
    emails = list(
        User.objects.filter(is_active=True, role__in=RECIPIENT_ROLES)
        .exclude(email='')
        .order_by('email')
        .values_list('email', flat=True)
    )
    owner = issue.opportunity.owner
    if owner and owner.is_active and owner.email:
        emails.append(owner.email)
    return _clean(emails)


def _reason_labels(issue: PoDocumentIssue) -> list[str]:
    return [PO_ISSUE_REASONS.get(code, code) for code in issue.reasons or []]


def _load(issue_id) -> PoDocumentIssue | None:
    return (
        PoDocumentIssue.objects.select_related(
            'opportunity', 'opportunity__company', 'opportunity__owner', 'raised_by', 'resolved_by',
        )
        .prefetch_related('attachments')
        .filter(pk=issue_id)
        .first()
    )


def build_issue_email(issue: PoDocumentIssue) -> tuple[str, str]:
    opp = issue.opportunity
    company = opp.company.name if opp.company_id else ''
    subject = f'PO document issue: {opp.prospect_number} · {company}'.rstrip(' ·')
    owner = opp.owner.name if opp.owner else (opp.owner_name or '—')
    raised_by = issue.raised_by.name if issue.raised_by else 'Ops'
    lines = [
        'Hi team,',
        '',
        f'{raised_by} could not validate the PO for this Win opportunity because of a problem with the uploaded documents.',
        '',
        f'Opportunity: {opp.prospect_number} · {opp.name}',
        f'Customer: {company or "—"}',
        f'Owner: {owner}',
        f'Raised by: {raised_by} on {timezone.localtime(issue.created_at).strftime("%d/%m/%Y %H:%M")}',
        '',
        'Reasons:',
    ]
    lines.extend(f'- {label}' for label in _reason_labels(issue))
    files = [item.file_name for item in issue.attachments.all()]
    if files:
        lines.extend(['', 'Flagged documents:'])
        lines.extend(f'- {name}' for name in files)
    if issue.note:
        lines.extend(['', 'Note from Ops:', issue.note])
    lines.extend([
        '',
        'What to do: open the opportunity in Pulse, click Documents, and use "Upload corrected documents". '
        'The issue is resolved automatically once corrected files are uploaded.',
    ])
    link = _opportunities_link()
    if link:
        lines.extend(['', f'Open Pulse opportunities: {link}'])
    lines.extend(['', '— TechServ Hub'])
    return subject, '\n'.join(lines)


def build_resolved_email(issue: PoDocumentIssue) -> tuple[str, str]:
    opp = issue.opportunity
    company = opp.company.name if opp.company_id else ''
    subject = f'Corrected documents uploaded: {opp.prospect_number} · {company}'.rstrip(' ·')
    who = issue.resolved_by.name if issue.resolved_by else 'The owner'
    lines = [
        f'Hi {issue.raised_by.name if issue.raised_by else "there"},',
        '',
        f'{who} uploaded corrected documents for {opp.prospect_number} · {opp.name}, '
        'so the PO document issue you raised is now resolved.',
    ]
    if issue.resolution_note:
        lines.extend(['', 'Note:', issue.resolution_note])
    lines.extend(['', 'You can open Won hand-off and validate the PO again.', '', '— TechServ Hub'])
    return subject, '\n'.join(lines)


def send_po_issue_email(issue_id) -> bool:
    issue = _load(issue_id)
    if issue is None or issue.email_sent_at:
        return False
    recipients = issue_recipients(issue)
    if not recipients:
        logger.warning('PO issue email skipped: no recipients issue=%s', issue.pk)
        return False
    subject, body = build_issue_email(issue)
    send_mail(subject, body, _from_email(), recipients, fail_silently=False)
    PoDocumentIssue.objects.filter(pk=issue.pk, email_sent_at__isnull=True).update(email_sent_at=timezone.now())
    logger.info('PO issue email sent issue=%s recipients=%s', issue.pk, len(recipients))
    return True


def send_po_issue_resolved_email(issue_id) -> bool:
    issue = _load(issue_id)
    if issue is None or issue.resolved_email_sent_at or not issue.resolved_at:
        return False
    raiser = issue.raised_by
    if not raiser or not raiser.is_active or not raiser.email:
        return False
    subject, body = build_resolved_email(issue)
    send_mail(subject, body, _from_email(), [raiser.email], fail_silently=False)
    PoDocumentIssue.objects.filter(pk=issue.pk, resolved_email_sent_at__isnull=True).update(
        resolved_email_sent_at=timezone.now(),
    )
    return True


def dispatch(task, sender, issue_id) -> None:
    """Queue `task` on Celery; if the broker is unreachable, send inline so the email is not lost."""
    try:
        task.apply_async(args=[str(issue_id)], retry=False)
    except Exception:
        logger.warning('Celery unavailable, sending PO issue email inline issue=%s', issue_id, exc_info=True)
        try:
            sender(issue_id)
        except Exception:
            logger.exception('PO issue email failed issue=%s', issue_id)
