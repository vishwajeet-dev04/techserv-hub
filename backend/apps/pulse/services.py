from datetime import date, datetime, time, timedelta
from decimal import Decimal

from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from django.db.models import ProtectedError
from django.utils import timezone
from rest_framework.exceptions import ValidationError as DrfValidationError

from apps.pulse.constants import (
    CURRENCIES,
    HIGH_VALUE_INR,
    LOST_STAGES,
    MAX_STAGE_ATTACHMENT_BYTES,
    MAX_STAGE_ATTACHMENTS,
    OPEN_PIPELINE_STAGES,
    SALES_STAGES,
    SERVICE_PILLARS,
    STAGE_ATTACHMENT_EXTENSIONS,
    SUB_CATEGORIES,
    WON_STAGES,
    coerce_currency,
    coerce_pillar,
    coerce_sales_stage,
    coerce_sub_category,
    status_for_sales_stage,
)
from apps.pulse.excel import (
    build_contact_workbook,
    build_opportunity_workbook,
    contact_export_row,
    dummy_contact_rows,
    dummy_opportunity_rows,
    load_contacts_from_workbook,
    load_opportunities_from_workbook,
    open_upload,
    opportunity_export_row,
)
from apps.pulse.models import (
    Opportunity,
    OpportunityActivity,
    OpportunityActivityAction,
    OpportunityActivityAttachment,
    PulseContact,
    Reminder,
    ReminderStatus,
    ReminderType,
)
from apps.pulse.repositories import (
    CompanyLookupRepository,
    OpportunityRepository,
    PulseContactRepository,
    ReminderRepository,
    UserLookupRepository,
)

PLACEHOLDER = '—'


def _require(fields: dict[str, str], mapping: dict[str, str]) -> None:
    errors = {}
    for key, label in mapping.items():
        value = fields.get(key)
        if value is None or (isinstance(value, str) and not value.strip()):
            errors[key] = f'{label} is required.'
    if errors:
        raise DrfValidationError(errors)


def _valid_email(value: str, field: str, required: bool) -> str:
    text = (value or '').strip()
    if not text:
        if required:
            raise DrfValidationError({field: 'This field is required.'})
        return ''
    if ' ' in text or '..' in text:
        raise DrfValidationError({field: 'Enter a valid email address.'})
    parts = text.split('@')
    if len(parts) != 2 or not parts[0] or not parts[1]:
        raise DrfValidationError({field: 'Enter a valid email address.'})
    local, domain = parts
    if local.startswith('.') or local.endswith('.') or domain.startswith('.') or domain.endswith('.'):
        raise DrfValidationError({field: 'Enter a valid email address.'})
    tld = domain.rsplit('.', 1)[-1] if '.' in domain else ''
    if len(tld) < 2 or not tld.isalpha():
        raise DrfValidationError({field: 'Enter a valid email address.'})
    try:
        validate_email(text)
    except DjangoValidationError as exc:
        raise DrfValidationError({field: 'Enter a valid email address.'}) from exc
    return text


def _valid_phone(value: str, field: str = 'phone') -> str:
    text = (value or '').strip()
    if not text:
        raise DrfValidationError({field: 'This field is required.'})
    digits = ''.join(ch for ch in text if ch.isdigit())
    if len(digits) < 10 or len(digits) > 15:
        raise DrfValidationError({field: 'Enter a valid phone number (10–15 digits).'})
    return text[:40]


class PulseService:
    def __init__(self):
        self.contacts = PulseContactRepository()
        self.opportunities = OpportunityRepository()
        self.reminders = ReminderRepository()
        self.companies = CompanyLookupRepository()
        self.users = UserLookupRepository()

    def list_contacts(self, search=None):
        return self.contacts.list(search=search)

    def get_contact(self, pk) -> PulseContact:
        return self.contacts.get(pk)

    def create_contact(self, *, company_name: str, strict: bool = True, created_at=None, **fields) -> PulseContact:
        payload = self._contact_payload(company_name=company_name, strict=strict, **fields)
        company = self.companies.get_or_create_by_name(payload.pop('company_name'))
        instance = self.contacts.create(company=company, **payload)
        if created_at:
            PulseContact.objects.filter(pk=instance.pk).update(created_at=created_at)
            instance.created_at = created_at
        return instance

    def update_contact(self, instance: PulseContact, *, company_name: str | None = None, **fields) -> PulseContact:
        merged = {
            'name': fields.get('name', instance.name),
            'designation': fields.get('designation', instance.designation),
            'department': fields.get('department', instance.department),
            'email': fields.get('email', instance.email),
            'company_email': fields.get('company_email', instance.company_email),
            'phone': fields.get('phone', instance.phone),
            'address_1': fields.get('address_1', instance.address_1),
            'city': fields.get('city', instance.city),
            'state': fields.get('state', instance.state),
            'country': fields.get('country', instance.country),
            'gst_number': fields.get('gst_number', instance.gst_number),
        }
        payload = self._contact_payload(
            company_name=company_name if company_name is not None else instance.company.name,
            strict=True,
            **merged,
        )
        instance.company = self.companies.get_or_create_by_name(payload.pop('company_name'))
        for key, value in payload.items():
            setattr(instance, key, value)
        return self.contacts.save(instance)

    def delete_contact(self, instance: PulseContact) -> None:
        try:
            self.contacts.delete(instance)
        except ProtectedError as exc:
            raise DrfValidationError(
                'This contact is used by opportunities and cannot be deleted.'
            ) from exc

    def _contact_payload(self, *, company_name: str, strict: bool, **fields) -> dict:
        name = (fields.get('name') or '').strip()
        company = (company_name or '').strip()
        department = (fields.get('department') or '').strip()
        phone = (fields.get('phone') or '').strip()
        city = (fields.get('city') or '').strip()
        state = (fields.get('state') or '').strip()
        country = (fields.get('country') or '').strip()
        email = (fields.get('email') or '').strip()
        if not strict:
            department = department or PLACEHOLDER
            phone = phone or PLACEHOLDER
            city = city or PLACEHOLDER
            state = state or PLACEHOLDER
            country = country or PLACEHOLDER
            email = email or 'unspecified@placeholder.local'
        _require(
            {
                'name': name,
                'company_name': company,
                'department': department,
                'city': city,
                'state': state,
                'country': country,
            },
            {
                'name': 'Contact name',
                'company_name': 'Company name',
                'department': 'Department',
                'city': 'City',
                'state': 'State',
                'country': 'Country',
            },
        )
        phone_value = ''
        if phone:
            phone_value = _valid_phone(phone) if strict else phone[:40]
        elif not strict:
            phone_value = PLACEHOLDER
        return {
            'name': name[:255],
            'company_name': company[:255],
            'designation': (fields.get('designation') or '').strip()[:150],
            'department': department[:150],
            'email': _valid_email(email, 'email', required=False),
            'company_email': _valid_email(fields.get('company_email') or '', 'company_email', required=False),
            'phone': phone_value,
            'address_1': (fields.get('address_1') or '').strip()[:255],
            'city': city[:120],
            'state': state[:120],
            'country': country[:120],
            'gst_number': (fields.get('gst_number') or '').strip()[:40],
        }

    def list_opportunities(self, search=None, stage=None):
        return self.opportunities.list(search=search, stage=stage)

    def get_opportunity(self, pk) -> Opportunity:
        return self.opportunities.get(pk)

    def next_prospect_number(self) -> str:
        return f'PRO-{self.opportunities.max_prospect_suffix() + 1:03d}'

    def list_assignees(self) -> list[dict]:
        return [
            {'id': user.id, 'name': user.name, 'role': user.role}
            for user in self.users.list_active()
        ]

    def _resolve_owner(
        self,
        *,
        owner_id=None,
        owner_name: str = '',
        strict: bool = True,
    ):
        if owner_id:
            user = self.users.get_active_by_id(owner_id)
            if not user:
                raise DrfValidationError({'owner': 'Select a valid team member.'})
            return user, user.name
        assigned = (owner_name or '').strip()
        user = self.users.find_by_name(assigned) if assigned else None
        if strict and assigned and not user:
            raise DrfValidationError({'owner': 'Select a valid team member.'})
        return user, assigned

    def create_opportunity(
        self,
        *,
        name: str,
        owner_name: str = '',
        owner_id=None,
        strict: bool = True,
        **fields,
    ) -> Opportunity:
        contact = self._resolve_contact(fields, strict=strict)
        owner, resolved_name = self._resolve_owner(
            owner_id=owner_id,
            owner_name=owner_name,
            strict=strict,
        )
        payload = self._opportunity_payload(name=name, owner_name=resolved_name, strict=strict, **fields)
        prospect = payload.pop('prospect_number')
        if not prospect or self.opportunities.prospect_number_taken(prospect):
            prospect = self.next_prospect_number()
        created = self.opportunities.create(
            prospect_number=prospect,
            company=contact.company,
            contact=contact,
            owner=owner,
            **payload,
        )
        self._sync_opportunity_date_reminders(created)
        return created

    def update_opportunity(
        self,
        instance: Opportunity,
        *,
        owner_name: str | None = None,
        owner_id=None,
        company_name: str | None = None,
        contact_name: str | None = None,
        actor=None,
        stage_change_note: str | None = None,
        attachment_files=None,
        **fields,
    ) -> Opportunity:
        contact_id = fields.pop('contact', None)
        if contact_id or (company_name and contact_name):
            instance.contact = self._resolve_contact({
                'contact': contact_id or instance.contact_id,
                'company_name': company_name,
                'contact_name': contact_name,
            })
            instance.company = instance.contact.company
        merged_name = fields.get('name', instance.name)
        if owner_id is not None:
            owner, merged_owner = self._resolve_owner(owner_id=owner_id, owner_name='', strict=True)
        elif owner_name is not None:
            owner, merged_owner = self._resolve_owner(owner_name=owner_name, strict=True)
        else:
            owner, merged_owner = instance.owner, instance.owner_name
        previous_stage = instance.stage
        previous_follow_up = instance.follow_up_date
        previous_close = instance.expected_close_date
        next_stage = fields.get('stage', instance.stage)
        stage_changing = 'stage' in fields and coerce_sales_stage(str(next_stage or '')) != previous_stage
        uploads = list(attachment_files or [])
        if uploads and not stage_changing:
            raise DrfValidationError({'files': 'Attachments are only allowed when changing sales stage.'})
        if stage_changing:
            note = (stage_change_note if stage_change_note is not None else fields.get('stage_note') or '').strip()
            follow_up = fields.get('follow_up_date', instance.follow_up_date)
            if not note:
                raise DrfValidationError({'stage_note': 'Notes are required when changing sales stage.'})
            if not follow_up:
                raise DrfValidationError({'follow_up_date': 'Follow-up date is required when changing sales stage.'})
            self._validate_stage_attachments(uploads, to_stage=coerce_sales_stage(str(next_stage or '')))
            if coerce_sales_stage(str(next_stage or '')) == 'Negotiation':
                negotiated_raw = fields.get('negotiated_amount', instance.negotiated_amount)
                try:
                    negotiated_value = (
                        negotiated_raw
                        if isinstance(negotiated_raw, Decimal)
                        else Decimal(str(negotiated_raw or '0'))
                    )
                except Exception:
                    negotiated_value = Decimal('0')
                if negotiated_value <= 0:
                    raise DrfValidationError({
                        'negotiated_amount': 'Final negotiation value is required when moving to Negotiation.',
                    })
        payload = self._opportunity_payload(
            name=merged_name,
            owner_name=merged_owner,
            strict=True,
            require_amount='expected_amount' in fields,
            require_close_date='expected_close_date' in fields,
            prospect_number=instance.prospect_number,
            service_pillar=fields.get('service_pillar', instance.service_pillar),
            sub_category=fields.get('sub_category', instance.sub_category),
            stage=fields.get('stage', instance.stage),
            expected_amount=fields.get('expected_amount', instance.expected_amount),
            negotiated_amount=fields.get('negotiated_amount', instance.negotiated_amount),
            currency=fields.get('currency', instance.currency),
            lead_source=fields.get('lead_source', instance.lead_source),
            delivery_partner=fields.get('delivery_partner', instance.delivery_partner),
            department=fields.get('department', instance.department),
            follow_up_date=fields.get('follow_up_date', instance.follow_up_date),
            expected_close_date=fields.get('expected_close_date', instance.expected_close_date),
            comments=fields.get('comments', instance.comments),
        )
        payload.pop('prospect_number', None)
        instance.owner_name = payload['owner_name']
        instance.owner = owner
        for key, value in payload.items():
            setattr(instance, key, value)
        saved = self.opportunities.save(instance)
        if stage_changing:
            note = (stage_change_note if stage_change_note is not None else fields.get('stage_note') or '').strip()
            if note and note not in (saved.comments or ''):
                saved.comments = f'{saved.comments}\n{note}'.strip() if saved.comments else note
                saved = self.opportunities.save(saved)
            activity = OpportunityActivity.objects.create(
                opportunity=saved,
                actor=actor,
                action=OpportunityActivityAction.STAGE_CHANGE,
                from_stage=previous_stage,
                to_stage=saved.stage,
                note=note,
                follow_up_date=saved.follow_up_date,
            )
            self._save_stage_attachments(activity, uploads, actor=actor)
        self._sync_opportunity_date_reminders(
            saved,
            previous_follow_up=previous_follow_up,
            previous_close=previous_close,
        )
        return saved

    def _sync_opportunity_date_reminders(
        self,
        opportunity: Opportunity,
        *,
        previous_follow_up=None,
        previous_close=None,
    ) -> None:
        """Upsert PENDING FOLLOW_UP / CLOSE_DATE reminders from opportunity dates."""
        self._upsert_date_reminder(
            opportunity,
            reminder_type=ReminderType.FOLLOW_UP,
            due_date=opportunity.follow_up_date,
            previous_due=previous_follow_up,
            title_prefix='Follow up',
            description='Auto reminder from opportunity follow-up date.',
        )
        self._upsert_date_reminder(
            opportunity,
            reminder_type=ReminderType.CLOSE_DATE,
            due_date=opportunity.expected_close_date,
            previous_due=previous_close,
            title_prefix='Close date',
            description='Auto reminder from opportunity expected close date.',
        )

    def _upsert_date_reminder(
        self,
        opportunity: Opportunity,
        *,
        reminder_type: str,
        due_date,
        previous_due,
        title_prefix: str,
        description: str,
    ) -> None:
        pending = (
            Reminder.objects.filter(
                opportunity=opportunity,
                reminder_type=reminder_type,
                status=ReminderStatus.PENDING,
            )
            .order_by('-updated_at')
            .first()
        )
        if not due_date:
            if pending:
                pending.status = ReminderStatus.DONE
                self.reminders.save(pending)
            return

        title = f'{title_prefix} · {opportunity.prospect_number} · {opportunity.name}'[:255]
        if pending:
            pending.title = title
            pending.due_date = due_date
            pending.description = description
            pending.contact = opportunity.contact
            self.reminders.save(pending)
            return

        # Date unchanged and nothing PENDING — do not recreate after a DONE reminder.
        if previous_due == due_date:
            return

        self.reminders.create(
            title=title,
            reminder_type=reminder_type,
            status=ReminderStatus.PENDING,
            due_date=due_date,
            description=description,
            opportunity=opportunity,
            contact=opportunity.contact,
        )
    def _validate_stage_attachments(self, uploads, *, to_stage: str = '') -> None:
        if to_stage == 'Win' and len(uploads) < 1:
            raise DrfValidationError({
                'files': 'At least one document is required when moving to Win.',
            })
        if len(uploads) > MAX_STAGE_ATTACHMENTS:
            raise DrfValidationError({
                'files': f'At most {MAX_STAGE_ATTACHMENTS} files can be attached.',
            })
        for upload in uploads:
            name = (getattr(upload, 'name', '') or '').lower()
            ext = ''
            if '.' in name:
                ext = '.' + name.rsplit('.', 1)[-1]
            if ext not in STAGE_ATTACHMENT_EXTENSIONS:
                raise DrfValidationError({
                    'files': f'File type not allowed for {getattr(upload, "name", "file")}.',
                })
            size = getattr(upload, 'size', None) or 0
            if size > MAX_STAGE_ATTACHMENT_BYTES:
                raise DrfValidationError({
                    'files': f'Each file must be at most {MAX_STAGE_ATTACHMENT_BYTES // (1024 * 1024)} MB.',
                })

    def _save_stage_attachments(self, activity: OpportunityActivity, uploads, *, actor=None) -> None:
        for upload in uploads:
            OpportunityActivityAttachment.objects.create(
                activity=activity,
                file=upload,
                file_name=(getattr(upload, 'name', '') or 'attachment')[:255],
                content_type=(getattr(upload, 'content_type', '') or '')[:120],
                byte_size=getattr(upload, 'size', None) or 0,
                uploaded_by=actor,
            )

    def list_opportunity_activities(self, opportunity_id):
        return (
            OpportunityActivity.objects.filter(opportunity_id=opportunity_id)
            .select_related('actor')
            .prefetch_related('attachments', 'attachments__uploaded_by')
        )

    def list_ops_updates(self, *, limit: int = 50):
        limit = max(1, min(int(limit or 50), 100))
        return (
            OpportunityActivity.objects.filter(action=OpportunityActivityAction.STAGE_CHANGE)
            .select_related('actor', 'opportunity', 'opportunity__company')
            .prefetch_related('attachments', 'attachments__uploaded_by')
            .order_by('-created_at')[:limit]
        )

    def delete_opportunity(self, instance: Opportunity) -> None:
        self.opportunities.delete(instance)

    def _resolve_contact(self, fields: dict, strict: bool = True) -> PulseContact:
        contact = fields.get('contact')
        if isinstance(contact, PulseContact):
            return contact
        if contact:
            try:
                return self.contacts.get(contact)
            except PulseContact.DoesNotExist as exc:
                raise DrfValidationError({'contact': 'Contact not found.'}) from exc
        company_name = (fields.get('company_name') or '').strip()
        contact_name = (fields.get('contact_name') or '').strip()
        if not company_name or not contact_name:
            raise DrfValidationError({
                'contact': 'Select a company and contact from the Contacts table.',
            })
        found = self.contacts.find_by_company_and_name(company_name, contact_name)
        if found:
            return found
        raise DrfValidationError({
            'contact': f'No contact named "{contact_name}" at "{company_name}".',
        })

    def _opportunity_payload(
        self, *, name: str, owner_name: str, strict: bool, require_amount: bool = True, require_close_date: bool = True, **fields
    ) -> dict:
        prospect_name = (name or '').strip()
        assigned = (owner_name or '').strip()
        pillar = coerce_pillar(fields.get('service_pillar') or '')
        sub = coerce_sub_category(fields.get('sub_category') or '')
        stage = coerce_sales_stage(fields.get('stage') or '')
        amount = fields.get('expected_amount')
        if amount in (None, ''):
            amount = Decimal('0')
        if not isinstance(amount, Decimal):
            amount = Decimal(str(amount))
        if not strict:
            assigned = assigned or PLACEHOLDER
            if pillar not in SERVICE_PILLARS:
                pillar = 'Consulting'
            if sub not in SUB_CATEGORIES:
                sub = 'Resources'
            if stage not in SALES_STAGES:
                stage = SALES_STAGES[0]
        _require(
            {
                'name': prospect_name,
                'owner_name': assigned,
                'service_pillar': pillar,
                'sub_category': sub,
                'stage': stage,
            },
            {
                'name': 'Prospect name',
                'owner_name': 'Assigned to',
                'service_pillar': 'Service pillar',
                'sub_category': 'Sub-category',
                'stage': 'Sales stage',
            },
        )
        if amount < 0:
            raise DrfValidationError({'expected_amount': 'Expected amount is required.'})
        if strict and require_amount and amount == 0:
            raise DrfValidationError({'expected_amount': 'Expected amount is required.'})
        if pillar not in SERVICE_PILLARS:
            raise DrfValidationError({'service_pillar': 'Select a valid service pillar.'})
        if sub not in SUB_CATEGORIES:
            raise DrfValidationError({'sub_category': 'Select a valid sub-category.'})
        if stage not in SALES_STAGES:
            raise DrfValidationError({'stage': 'Select a valid sales stage.'})
        currency_raw = (fields.get('currency') or '').strip()
        if strict and not currency_raw:
            raise DrfValidationError({'currency': 'Select a currency before continuing.'})
        currency = coerce_currency(currency_raw)
        if currency not in CURRENCIES:
            raise DrfValidationError({'currency': 'Select a currency before continuing.'})
        close_date = fields.get('expected_close_date')
        if strict and require_close_date and not close_date:
            raise DrfValidationError({'expected_close_date': 'Expected close date is required.'})
        negotiated = fields.get('negotiated_amount') or Decimal('0')
        if not isinstance(negotiated, Decimal):
            negotiated = Decimal(str(negotiated or '0'))
        if negotiated < 0:
            raise DrfValidationError({'negotiated_amount': 'Amount cannot be negative.'})
        # Guard against fat-finger values that break pipeline / chart scales (e.g. 11111111111).
        max_amount = Decimal('10000000000')  # ₹1,000 Cr
        if amount > max_amount:
            raise DrfValidationError({'expected_amount': 'Expected amount is unrealistically high. Check the value.'})
        if negotiated > max_amount:
            raise DrfValidationError({'negotiated_amount': 'Negotiated amount is unrealistically high. Check the value.'})
        if amount > 0 and negotiated > amount * 20:
            raise DrfValidationError({
                'negotiated_amount': 'Negotiated amount is more than 20× expected. Check the value.',
            })
        return {
            'prospect_number': (fields.get('prospect_number') or '').strip()[:32],
            'name': prospect_name[:255],
            'owner_name': assigned[:255],
            'lead_source': (fields.get('lead_source') or '').strip()[:150],
            'service_pillar': pillar,
            'sub_category': sub,
            'delivery_partner': (fields.get('delivery_partner') or '').strip()[:150],
            'stage': stage,
            'status': status_for_sales_stage(stage),
            'expected_amount': amount,
            'negotiated_amount': negotiated,
            'currency': currency,
            'department': '',
            'follow_up_date': fields.get('follow_up_date'),
            'expected_close_date': close_date,
            'comments': fields.get('comments') or '',
        }

    def list_reminders(self, search=None, status=None, reminder_type=None):
        return self.reminders.list(search=search, status=status, reminder_type=reminder_type)

    def get_reminder(self, pk) -> Reminder:
        return self.reminders.get(pk)

    def create_reminder(self, **fields) -> Reminder:
        payload = self._reminder_payload(require_due_date=True, **fields)
        return self.reminders.create(**payload)

    def update_reminder(self, instance: Reminder, **fields) -> Reminder:
        from apps.pulse.models import ReminderType

        if 'title' in fields:
            title = (fields.pop('title') or '').strip()
            if not title:
                raise DrfValidationError({'title': 'This field is required.'})
            if len(title) > 255:
                raise DrfValidationError({'title': 'Ensure this field has no more than 255 characters.'})
            instance.title = title
        if 'reminder_type' in fields:
            reminder_type = fields.pop('reminder_type')
            valid_types = {choice for choice, _ in ReminderType.choices}
            if reminder_type not in valid_types:
                raise DrfValidationError({'reminder_type': 'Select a valid reminder type.'})
            instance.reminder_type = reminder_type
        if 'description' in fields:
            description = fields.pop('description') or ''
            if len(description) > 5000:
                raise DrfValidationError({'description': 'Description is too long.'})
            instance.description = description
        for key, value in fields.items():
            setattr(instance, key, value)
        return self.reminders.save(instance)

    def _reminder_payload(self, *, require_due_date: bool, **fields) -> dict:
        from apps.pulse.models import ReminderType

        title = (fields.get('title') or '').strip()
        if not title:
            raise DrfValidationError({'title': 'This field is required.'})
        if len(title) > 255:
            raise DrfValidationError({'title': 'Ensure this field has no more than 255 characters.'})
        reminder_type = fields.get('reminder_type') or ReminderType.TASK
        valid_types = {choice for choice, _ in ReminderType.choices}
        if reminder_type not in valid_types:
            raise DrfValidationError({'reminder_type': 'Select a valid reminder type.'})
        due_date = fields.get('due_date')
        if require_due_date and not due_date:
            raise DrfValidationError({'due_date': 'Due date is required.'})
        description = fields.get('description') or ''
        if len(description) > 5000:
            raise DrfValidationError({'description': 'Description is too long.'})
        return {
            'title': title,
            'reminder_type': reminder_type,
            'due_date': due_date,
            'description': description,
            'opportunity': fields.get('opportunity'),
            'contact': fields.get('contact'),
            'status': fields.get('status', 'PENDING'),
        }

    def mark_reminder_done(self, instance: Reminder) -> Reminder:
        instance.status = ReminderStatus.DONE
        return self.reminders.save(instance)

    def delete_reminder(self, instance: Reminder) -> None:
        self.reminders.delete(instance)

    def pipeline_dashboard(self, date_from: str | None = None, date_to: str | None = None) -> dict:
        created_from, created_to = self._created_range(date_from, date_to)
        contacts = self.contacts.count(created_from=created_from, created_to=created_to)
        qs = self.opportunities.filtered(created_from=created_from, created_to=created_to)
        totals = self.opportunities.stage_totals(qs)
        stages = {name: int(row['count']) for name, row in totals.items()}
        deals = qs.count()
        win = stages.get('Win', 0)
        lost = stages.get('Lost', 0)
        cancelled = stages.get('Cancelled', 0)
        decided = win + lost + cancelled
        win_rate = int(round((win / decided) * 100)) if decided else 0
        open_count = qs.filter(status='OPEN').count()
        if contacts == 0 and deals == 0:
            insight = 'No Pulse CRM contacts or opportunities yet. Import or add them in Pulse.'
        else:
            insight = f'{open_count} open opportunities in Pulse.'

        stage_flow = [
            {
                'key': name,
                'label': name,
                'count': stages.get(name, 0),
                'value': float(totals.get(name, {}).get('value') or 0),
            }
            for name in SALES_STAGES
        ]
        total_prospects = sum(item['count'] for item in stage_flow)
        flow = [
            {'key': 'prospects', 'label': 'Total Opportunities', 'count': total_prospects},
            *stage_flow,
        ]
        by_stage = [
            {
                'stage': name,
                'count': int(totals.get(name, {}).get('count', 0)),
                'value': float(totals.get(name, {}).get('value') or 0),
            }
            for name in SALES_STAGES
        ]
        open_by_stage = [
            {
                'stage': name,
                'count': int(totals.get(name, {}).get('count', 0)),
                'value': float(totals.get(name, {}).get('value') or 0),
            }
            for name in OPEN_PIPELINE_STAGES
        ]
        open_pipeline_count = sum(row['count'] for row in open_by_stage)
        open_pipeline_value = sum(row['value'] for row in open_by_stage)
        company_rows = self.opportunities.expected_vs_negotiated_by_company(qs)
        return {
            'contacts': contacts,
            'opportunities': deals,
            'total_prospects': total_prospects,
            'win_rate': win_rate,
            'pipeline_value': float(open_pipeline_value),
            'open_opportunities': open_count,
            'open_pipeline': {
                'count': open_pipeline_count,
                'value': float(open_pipeline_value),
                'by_stage': open_by_stage,
            },
            'insight': insight,
            'flow': flow,
            'by_source': self.opportunities.source_counts(qs),
            'by_stage': by_stage,
            'expected_vs_negotiated': [
                {
                    'name': row['company__name'] or 'Unspecified',
                    'expected': float(row['expected'] or 0),
                    'negotiated': float(row['negotiated'] or 0),
                }
                for row in company_rows
            ],
        }

    def team_dashboard(self, date_from: str | None = None, date_to: str | None = None) -> dict:
        created_from, created_to = self._created_range(date_from, date_to)
        qs = self.opportunities.filtered(created_from=created_from, created_to=created_to).select_related('owner')
        buckets: dict[str, dict] = {}
        for opp in qs:
            name = (opp.owner_name or '').strip() or (opp.owner.name if opp.owner else '') or 'Unassigned'
            row = buckets.setdefault(
                name,
                {
                    'name': name,
                    'total_leads': 0,
                    'converted': 0,
                    'won_count': 0,
                    'lost_count': 0,
                    'won_value': Decimal('0'),
                },
            )
            row['total_leads'] += 1
            if opp.stage == 'Commercial':
                row['converted'] += 1
            if opp.stage in WON_STAGES:
                row['won_count'] += 1
                negotiated = opp.negotiated_amount or Decimal('0')
                expected = opp.expected_amount or Decimal('0')
                row['won_value'] += negotiated if negotiated > 0 else expected
            elif opp.stage in LOST_STAGES:
                row['lost_count'] += 1

        by_rep = []
        for row in buckets.values():
            decided = row['won_count'] + row['lost_count']
            win_rate = int(round((row['won_count'] / decided) * 100)) if decided else 0
            by_rep.append(
                {
                    'name': row['name'],
                    'total_leads': row['total_leads'],
                    'converted': row['converted'],
                    'won_count': row['won_count'],
                    'lost_count': row['lost_count'],
                    'win_rate': win_rate,
                    'won_value': float(row['won_value']),
                }
            )
        by_rep.sort(key=lambda item: (-item['total_leads'], -item['won_value'], item['name']))
        top = max(by_rep, key=lambda item: (item['won_value'], item['total_leads'])) if by_rep else None
        return {
            'active_reps': len(by_rep),
            'total_leads': sum(item['total_leads'] for item in by_rep),
            'top_rep': top['name'] if top else '',
            'total_won_value': float(sum(item['won_value'] for item in by_rep)),
            'by_rep': by_rep,
        }

    def executive_dashboard(self, date_from: str | None = None, date_to: str | None = None) -> dict:
        created_from, created_to = self._created_range(date_from, date_to)
        current = self._executive_slice(created_from, created_to)
        prior = None
        if created_from is not None and created_to is not None:
            span = created_to - created_from
            prior_to = created_from - timedelta(microseconds=1)
            prior_from = prior_to - span
            prior = self._executive_slice(prior_from, prior_to)
        all_time = self._executive_slice(None, None)
        won_count = all_time['won_count']
        avg_deal_size = (all_time['revenue_won'] / won_count) if won_count else 0.0
        lead_conversion = int(round((all_time['deals'] / all_time['leads']) * 100)) if all_time['leads'] else 0
        return {
            **current,
            'revenue_won_prior': prior['revenue_won'] if prior else None,
            'pipeline_value_prior': prior['pipeline_value'] if prior else None,
            'win_rate_prior': prior['win_rate'] if prior else None,
            'deals_closed_prior': prior['deals_closed'] if prior else None,
            'benchmarks': {
                'avg_deal_size': avg_deal_size,
                'sales_cycle_days': all_time['sales_cycle_days'],
                'lead_conversion': lead_conversion,
            },
        }

    def _executive_slice(self, created_from, created_to) -> dict:
        leads = self.contacts.count(created_from=created_from, created_to=created_to)
        qs = self.opportunities.filtered(created_from=created_from, created_to=created_to)
        deals = qs.count()
        win = qs.filter(stage='Win').count()
        closed = qs.filter(stage='Closed').count()
        lost = qs.filter(stage='Lost').count()
        cancelled = qs.filter(stage='Cancelled').count()
        won_total = win + closed
        decided = won_total + lost + cancelled
        win_rate = int(round((won_total / decided) * 100)) if decided else 0
        pipeline_value = float(self.opportunities.pipeline_value(qs, LOST_STAGES) or Decimal('0'))
        revenue_won = Decimal('0')
        cycle_days: list[float] = []
        pillar_won: dict[str, int] = {}
        pillar_win_value: dict[str, Decimal] = {}
        pillar_closed_value: dict[str, Decimal] = {}
        volume: dict[str, dict] = {}

        def bucket(week: str) -> dict:
            return volume.setdefault(
                week,
                {'week': week, 'leads': 0, 'deals': 0, 'won_value': 0.0, 'win': 0, 'lost': 0},
            )

        for contact in self.contacts.filtered(created_from=created_from, created_to=created_to).only('created_at'):
            bucket(self._week_key(contact.created_at))['leads'] += 1

        for opp in qs:
            week = bucket(self._week_key(opp.created_at))
            week['deals'] += 1
            amount = self._won_amount(opp)
            pillar = (opp.service_pillar or '').strip() or 'Unspecified'
            if opp.stage == 'Win':
                week['win'] += 1
                week['won_value'] += float(amount)
                revenue_won += amount
                pillar_won[pillar] = pillar_won.get(pillar, 0) + 1
                pillar_win_value[pillar] = pillar_win_value.get(pillar, Decimal('0')) + amount
                cycle_days.append(self._cycle_days(opp))
            elif opp.stage == 'Closed':
                week['won_value'] += float(amount)
                revenue_won += amount
                pillar_won[pillar] = pillar_won.get(pillar, 0) + 1
                pillar_closed_value[pillar] = pillar_closed_value.get(pillar, Decimal('0')) + amount
                cycle_days.append(self._cycle_days(opp))
            elif opp.stage in LOST_STAGES:
                week['lost'] += 1

        totals = self.opportunities.stage_totals(qs)
        pipeline_health = [
            {
                'stage': name,
                'count': int(totals.get(name, {}).get('count', 0)),
                'value': float(totals.get(name, {}).get('value') or 0),
            }
            for name in SALES_STAGES
            if int(totals.get(name, {}).get('count', 0)) > 0
        ]
        attention = [row for row in pipeline_health if row['stage'] != 'Win']
        attention.sort(key=lambda row: -row['count'])
        funnel = self._funnel_payload(leads, deals, win, closed)
        insights = self._executive_insights(
            self._merge_decimal_maps(pillar_win_value, pillar_closed_value),
            pipeline_value,
            float(revenue_won),
            funnel['drop'],
        )
        return {
            'revenue_won': float(revenue_won),
            'pipeline_value': pipeline_value,
            'win_rate': win_rate,
            'deals_closed': closed,
            'won_count': won_total,
            'leads': leads,
            'deals': deals,
            'funnel': funnel,
            'pipeline_health': pipeline_health,
            'attention': attention[:5],
            'by_pillar_won': [
                {'name': name, 'count': count, 'share': int(round((count / won_total) * 100)) if won_total else 0}
                for name, count in sorted(pillar_won.items(), key=lambda item: -item[1])
            ],
            'by_pillar_revenue': {
                'win': self._pillar_revenue_rows(pillar_win_value),
                'closed': self._pillar_revenue_rows(pillar_closed_value),
                'both': self._pillar_revenue_rows(self._merge_decimal_maps(pillar_win_value, pillar_closed_value)),
            },
            'volume': [volume[key] for key in sorted(volume)],
            'sales_cycle_days': int(round(sum(cycle_days) / len(cycle_days))) if cycle_days else 0,
            'insights': insights,
        }

    def _won_amount(self, opp: Opportunity) -> Decimal:
        negotiated = opp.negotiated_amount or Decimal('0')
        expected = opp.expected_amount or Decimal('0')
        return negotiated if negotiated > 0 else expected

    def _cycle_days(self, opp: Opportunity) -> float:
        start = opp.created_at
        end = opp.updated_at or opp.created_at
        return max(0.0, (end - start).total_seconds() / 86400)

    def _week_key(self, value) -> str:
        local = timezone.localtime(value) if timezone.is_aware(value) else value
        day = local.date()
        monday = day - timedelta(days=day.weekday())
        return monday.isoformat()

    def _pct(self, part: int, whole: int) -> int:
        return int(round((part / whole) * 100)) if whole else 0

    def _funnel_payload(self, leads: int, deals: int, win: int, closed: int) -> dict:
        steps = [
            {'key': 'leads', 'label': 'Leads', 'count': leads, 'from_label': '', 'conversion': 100 if leads else 0},
            {
                'key': 'deals',
                'label': 'Deals',
                'count': deals,
                'from_label': 'from Leads',
                'conversion': self._pct(deals, leads),
            },
            {
                'key': 'win',
                'label': 'Win',
                'count': win,
                'from_label': 'from Deals',
                'conversion': self._pct(win, deals),
            },
            {
                'key': 'closed',
                'label': 'Closed',
                'count': closed,
                'from_label': 'from Win',
                'conversion': self._pct(closed, win),
            },
        ]
        drop = {'from_label': '', 'to_label': '', 'percent': 0}
        pairs = [(steps[i], steps[i + 1]) for i in range(len(steps) - 1)]
        best = -1
        for start, finish in pairs:
            if start['count'] <= 0:
                continue
            percent = int(round(((start['count'] - finish['count']) / start['count']) * 100))
            if percent > best:
                best = percent
                drop = {'from_label': start['label'], 'to_label': finish['label'], 'percent': percent}
        return {'steps': steps, 'drop': drop}

    def _executive_insights(
        self,
        pillar_revenue: dict[str, Decimal],
        pipeline_value: float,
        revenue_won: float,
        drop: dict,
    ) -> dict:
        effective = []
        if pillar_revenue:
            top = max(pillar_revenue.items(), key=lambda item: item[1])
            effective.append(f'{top[0]} is the top contributor of won value this period.')
        if revenue_won > 0 and pipeline_value >= revenue_won:
            effective.append('Pipeline coverage is at least as large as won value — healthy.')
        elif revenue_won > 0:
            effective.append('Pipeline is thinner than won value this period — rebuild coverage.')
        if not effective:
            effective.append('Add Pulse contacts and opportunities to see coverage insights.')
        attention = []
        if drop.get('percent'):
            attention.append(
                f"Biggest funnel drop-off at {drop['from_label']} → {drop['to_label']} ({drop['percent']}%)."
            )
        if not attention:
            attention.append('No major funnel drop-off in this range.')
        return {'effective': effective, 'attention': attention}

    def _pillar_revenue_rows(self, amounts: dict[str, Decimal]) -> list[dict]:
        total = float(sum(amounts.values())) if amounts else 0.0
        rows = []
        for name, value in sorted(amounts.items(), key=lambda item: -item[1]):
            amount = float(value)
            rows.append({
                'name': name,
                'value': amount,
                'share': int(round((amount / total) * 100)) if total else 0,
            })
        return rows

    def _merge_decimal_maps(self, left: dict[str, Decimal], right: dict[str, Decimal]) -> dict[str, Decimal]:
        merged = dict(left)
        for key, value in right.items():
            merged[key] = merged.get(key, Decimal('0')) + value
        return merged

    def _created_range(self, date_from: str | None, date_to: str | None):
        start = self._parse_day(date_from, end=False)
        end = self._parse_day(date_to, end=True)
        if start and end and start > end:
            raise DrfValidationError({'from': 'Start date must be on or before end date.'})
        return start, end

    def _parse_day(self, value: str | None, *, end: bool):
        if not value or not str(value).strip():
            return None
        try:
            day = date.fromisoformat(str(value).strip())
        except ValueError as exc:
            raise DrfValidationError({'date': 'Use YYYY-MM-DD for the date range.'}) from exc
        clock = time.max if end else time.min
        combined = datetime.combine(day, clock)
        if timezone.is_naive(combined):
            return timezone.make_aware(combined)
        return combined

    def executive_summary(self) -> dict:
        opp = self.opportunities.summary()
        return {
            'contacts': self.contacts.list().count(),
            'opportunities': opp['count'],
            'open_opportunities': opp['open_count'],
            'won_opportunities': opp['won_count'],
            'lost_opportunities': opp['lost_count'],
            'pending_reminders': self.reminders.pending_count(),
            'pipeline_expected': float(opp['expected_total'] or Decimal('0')),
            'pipeline_negotiated': float(opp['negotiated_total'] or Decimal('0')),
            'pipeline_final': float(opp['negotiated_total'] or Decimal('0')),
            'high_value_threshold': HIGH_VALUE_INR,
            'service_pillars': SERVICE_PILLARS,
            'sub_categories': SUB_CATEGORIES,
            'sales_stages': SALES_STAGES,
            'currencies': CURRENCIES,
        }

    def settings_payload(self) -> dict:
        return {
            'high_value_threshold': HIGH_VALUE_INR,
            'default_currency': 'INR',
            'service_pillars': SERVICE_PILLARS,
            'sub_categories': SUB_CATEGORIES,
            'sales_stages': SALES_STAGES,
            'currencies': CURRENCIES,
            'companies': self.contacts.company_names(),
        }

    def export_contacts_xlsx(self) -> bytes:
        rows = [contact_export_row(item) for item in self.contacts.list()]
        return build_contact_workbook(rows)

    def contact_template_xlsx(self) -> bytes:
        return build_contact_workbook(dummy_contact_rows())

    def export_opportunities_xlsx(self) -> bytes:
        rows = [opportunity_export_row(item) for item in self.opportunities.list()]
        return build_opportunity_workbook(rows)

    def opportunity_template_xlsx(self) -> bytes:
        return build_opportunity_workbook(dummy_opportunity_rows(), with_validation=True)

    def import_contacts_xlsx(self, content: bytes) -> dict:
        workbook = open_upload(content)
        created = 0
        errors = []
        for excel_row, payload in load_contacts_from_workbook(workbook):
            created_at = payload.pop('created_at', None)
            try:
                self.create_contact(strict=True, created_at=created_at, **payload)
                created += 1
            except DrfValidationError as exc:
                errors.append({'row': excel_row, 'message': _flatten_error(exc)})
        return {'created': created, 'errors': errors}

    def import_opportunities_xlsx(self, content: bytes) -> dict:
        workbook = open_upload(content)
        created = 0
        errors = []
        for excel_row, payload in load_opportunities_from_workbook(workbook):
            try:
                if not payload.get('currency'):
                    payload['currency'] = 'INR'
                if not payload.get('expected_close_date'):
                    payload['expected_close_date'] = timezone.localdate() + timedelta(days=90)
                self.create_opportunity(strict=True, **payload)
                created += 1
            except DrfValidationError as exc:
                errors.append({'row': excel_row, 'message': _flatten_error(exc)})
        return {'created': created, 'errors': errors}

    def send_due_opportunity_date_reminders(self, *, as_of_date=None):
        from apps.pulse.reminder_emails import send_due_opportunity_date_reminders

        return send_due_opportunity_date_reminders(as_of_date=as_of_date)


def _flatten_error(exc: DrfValidationError) -> str:
    detail = exc.detail
    if isinstance(detail, dict):
        parts = []
        for key, value in detail.items():
            if isinstance(value, list):
                parts.append(f'{key}: {value[0]}')
            else:
                parts.append(f'{key}: {value}')
        return '; '.join(parts)
    return str(detail)


pulse_service = PulseService()
