from __future__ import annotations

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError as DrfValidationError

from apps.deals.models import PoDocumentIssue, PoDocumentIssueStatus
from apps.deals.po_constants import PO_ISSUE_REASONS
from apps.pulse.constants import WON_STAGES
from apps.pulse.models import Opportunity, OpportunityActivity, OpportunityActivityAttachment


def list_po_issues(*, opportunity: str | None = None, status: str | None = None):
    qs = PoDocumentIssue.objects.select_related(
        'opportunity', 'opportunity__company', 'raised_by', 'resolved_by',
    ).prefetch_related('attachments')
    if opportunity:
        qs = qs.filter(opportunity_id=opportunity)
    if status:
        qs = qs.filter(status=status.upper())
    return qs


def _queue_issue_email(issue_id) -> None:
    from apps.deals.po_issue_emails import dispatch, send_po_issue_email
    from apps.deals.tasks import send_po_issue_email_task

    dispatch(send_po_issue_email_task, send_po_issue_email, issue_id)


def _queue_resolved_email(issue_id) -> None:
    from apps.deals.po_issue_emails import dispatch, send_po_issue_resolved_email
    from apps.deals.tasks import send_po_issue_resolved_email_task

    dispatch(send_po_issue_resolved_email_task, send_po_issue_resolved_email, issue_id)


def create_po_issue(*, opportunity_id, reasons, attachment_ids=None, note: str = '', actor=None) -> PoDocumentIssue:
    opportunity = Opportunity.objects.filter(pk=opportunity_id).first() if opportunity_id else None
    if opportunity is None:
        raise DrfValidationError({'opportunity': 'Opportunity not found.'})
    if opportunity.stage not in WON_STAGES:
        raise DrfValidationError({'opportunity': 'Issues can only be raised on a Win opportunity.'})

    codes = list(dict.fromkeys(str(code).strip().upper() for code in (reasons or []) if str(code).strip()))
    if not codes:
        raise DrfValidationError({'reasons': 'Pick at least one reason.'})
    unknown = [code for code in codes if code not in PO_ISSUE_REASONS]
    if unknown:
        raise DrfValidationError({'reasons': f'Unknown reason: {", ".join(unknown)}.'})

    note = (note or '').strip()
    if 'OTHER' in codes and not note:
        raise DrfValidationError({'note': 'Add a note explaining the issue.'})

    ids = list(dict.fromkeys(str(value) for value in (attachment_ids or []) if value))
    attachments = list(
        OpportunityActivityAttachment.objects.filter(pk__in=ids, activity__opportunity=opportunity)
    ) if ids else []
    if len(attachments) != len(ids):
        raise DrfValidationError({'attachment_ids': 'One or more documents do not belong to this opportunity.'})

    with transaction.atomic():
        issue = PoDocumentIssue.objects.create(
            opportunity=opportunity,
            raised_by=actor,
            reasons=codes,
            note=note,
        )
        if attachments:
            issue.attachments.set(attachments)
        transaction.on_commit(lambda: _queue_issue_email(issue.pk))
    return issue


def resolve_po_issue(issue: PoDocumentIssue, *, actor=None, resolution_note: str = '') -> PoDocumentIssue:
    if issue.status == PoDocumentIssueStatus.RESOLVED:
        raise DrfValidationError({'status': 'This issue is already resolved.'})
    issue.status = PoDocumentIssueStatus.RESOLVED
    issue.resolved_by = actor
    issue.resolved_at = timezone.now()
    issue.resolution_note = (resolution_note or '').strip()
    issue.save(update_fields=['status', 'resolved_by', 'resolved_at', 'resolution_note'])
    return issue


def resolve_open_issues_for_documents(
    opportunity: Opportunity,
    *,
    activity: OpportunityActivity,
    actor=None,
) -> list[PoDocumentIssue]:
    issues = list(PoDocumentIssue.objects.filter(opportunity=opportunity, status=PoDocumentIssueStatus.OPEN))
    now = timezone.now()
    for issue in issues:
        issue.status = PoDocumentIssueStatus.RESOLVED
        issue.resolved_by = actor
        issue.resolved_at = now
        issue.resolution_note = activity.note
        issue.resolution_activity = activity
        issue.save(update_fields=[
            'status', 'resolved_by', 'resolved_at', 'resolution_note', 'resolution_activity',
        ])
        transaction.on_commit(lambda issue_id=issue.pk: _queue_resolved_email(issue_id))
    return issues
