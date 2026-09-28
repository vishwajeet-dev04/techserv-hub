from rest_framework import serializers

from apps.pulse.constants import (
    CURRENCIES,
    HIGH_VALUE_INR,
    SALES_STAGES,
    SERVICE_PILLARS,
    SUB_CATEGORIES,
    coerce_currency,
    coerce_sales_stage,
)
from apps.pulse.models import Opportunity, OpportunityActivity, OpportunityActivityAttachment, PulseContact, Reminder


class PulseContactSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source='company.name', read_only=True)
    company_name_input = serializers.CharField(write_only=True, required=False, allow_blank=False)

    class Meta:
        model = PulseContact
        fields = [
            'id', 'name', 'company', 'company_name', 'company_name_input',
            'designation', 'department', 'email', 'company_email', 'phone',
            'address_1', 'city', 'state', 'country', 'gst_number',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'company', 'created_at', 'updated_at']
        extra_kwargs = {
            'email': {'required': False, 'allow_blank': True},
            'phone': {'required': False, 'allow_blank': True},
        }

    def to_internal_value(self, data):
        payload = data.copy() if hasattr(data, 'copy') else dict(data)
        if 'company_name' in payload and 'company_name_input' not in payload:
            payload['company_name_input'] = payload.get('company_name')
        return super().to_internal_value(payload)


class OpportunitySerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source='company.name', read_only=True)
    contact_name = serializers.CharField(source='contact.name', read_only=True)
    company_name_input = serializers.CharField(write_only=True, required=False, allow_blank=True)
    contact_name_input = serializers.CharField(write_only=True, required=False, allow_blank=True)
    stage_note = serializers.CharField(write_only=True, required=False, allow_blank=True)
    owner_display = serializers.SerializerMethodField()
    is_high_value = serializers.SerializerMethodField()
    display_amount = serializers.SerializerMethodField()
    linked_po_count = serializers.SerializerMethodField()
    linked_po_value = serializers.SerializerMethodField()
    linked_pos = serializers.SerializerMethodField()

    class Meta:
        model = Opportunity
        fields = [
            'id', 'prospect_number', 'name', 'company', 'company_name', 'company_name_input',
            'contact', 'contact_name', 'contact_name_input',
            'owner', 'owner_name', 'owner_display',
            'lead_source', 'service_pillar', 'sub_category', 'delivery_partner',
            'stage', 'status', 'stage_note',
            'expected_amount', 'negotiated_amount', 'currency',
            'display_amount', 'is_high_value',
            'department', 'follow_up_date', 'expected_close_date',
            'comments', 'linked_po_count', 'linked_po_value', 'linked_pos',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'prospect_number', 'company', 'owner', 'status',
            'linked_po_count', 'linked_po_value', 'linked_pos',
            'created_at', 'updated_at',
        ]
        extra_kwargs = {
            'contact': {'required': False, 'allow_null': True},
            'stage': {'required': False},
            'service_pillar': {'required': False},
            'sub_category': {'required': False},
            'expected_amount': {'required': False},
            'currency': {'required': False},
            'department': {'required': False, 'allow_blank': True},
        }

    def get_owner_display(self, obj):
        if obj.owner_name:
            return obj.owner_name
        return obj.owner.name if obj.owner else ''

    def get_is_high_value(self, obj):
        return obj.is_high_value

    def get_display_amount(self, obj):
        return float(obj.display_amount)

    def get_linked_po_count(self, obj):
        workflows = getattr(obj, '_prefetched_objects_cache', {}).get('po_workflows')
        if workflows is not None:
            return len(workflows)
        return obj.po_workflows.count()

    def get_linked_po_value(self, obj):
        workflows = list(
            getattr(obj, '_prefetched_objects_cache', {}).get('po_workflows')
            or obj.po_workflows.all()
        )
        total = 0
        for row in workflows:
            if row.total_value is not None:
                total += float(row.total_value)
        return total

    def get_linked_pos(self, obj):
        from apps.deals.po_service import po_status

        workflows = list(
            getattr(obj, '_prefetched_objects_cache', {}).get('po_workflows')
            or obj.po_workflows.all()
        )
        return [
            {
                'id': str(row.id),
                'po_number': row.po_number,
                'status': po_status(row),
                'total_value': float(row.total_value) if row.total_value is not None else 0,
            }
            for row in workflows
        ]

    def to_internal_value(self, data):
        payload = data.copy() if hasattr(data, 'copy') else dict(data)
        if 'company_name' in payload and 'company_name_input' not in payload:
            payload['company_name_input'] = payload.get('company_name')
        if 'contact_name' in payload and 'contact_name_input' not in payload:
            payload['contact_name_input'] = payload.get('contact_name')
        return super().to_internal_value(payload)

    def validate_service_pillar(self, value):
        if value and value not in SERVICE_PILLARS:
            raise serializers.ValidationError('Select a valid service pillar.')
        return value

    def validate_sub_category(self, value):
        if value and value not in SUB_CATEGORIES:
            raise serializers.ValidationError('Select a valid sub-category.')
        return value

    def validate_stage(self, value):
        if not value:
            return value
        coerced = coerce_sales_stage(str(value))
        if coerced not in SALES_STAGES:
            raise serializers.ValidationError('Select a valid sales stage.')
        return coerced

    def validate_currency(self, value):
        if not value:
            return value
        coerced = coerce_currency(str(value))
        if coerced not in CURRENCIES:
            raise serializers.ValidationError('Select a valid currency.')
        return coerced


class OpportunityActivityAttachmentSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    uploaded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = OpportunityActivityAttachment
        fields = ['id', 'file_name', 'content_type', 'byte_size', 'url', 'created_at', 'uploaded_by_name']
        read_only_fields = fields

    def get_url(self, obj):
        if not obj.file:
            return None
        request = self.context.get('request')
        url = obj.file.url
        if request is not None:
            return request.build_absolute_uri(url)
        return url

    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by_id and getattr(obj.uploaded_by, 'name', None):
            return obj.uploaded_by.name
        return None


class OpportunityActivitySerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source='actor.name', read_only=True)
    attachments = OpportunityActivityAttachmentSerializer(many=True, read_only=True)

    class Meta:
        model = OpportunityActivity
        fields = [
            'id', 'opportunity', 'actor', 'actor_name', 'action',
            'from_stage', 'to_stage', 'note', 'follow_up_date', 'attachments', 'created_at',
        ]
        read_only_fields = fields


class OpsUpdateSerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source='actor.name', read_only=True, allow_null=True)
    opportunity_id = serializers.UUIDField(source='opportunity.id', read_only=True)
    prospect_number = serializers.CharField(source='opportunity.prospect_number', read_only=True)
    opportunity_name = serializers.CharField(source='opportunity.name', read_only=True)
    company_name = serializers.CharField(source='opportunity.company.name', read_only=True, allow_null=True)
    attachment_count = serializers.SerializerMethodField()
    attachments = OpportunityActivityAttachmentSerializer(many=True, read_only=True)

    class Meta:
        model = OpportunityActivity
        fields = [
            'id', 'opportunity_id', 'prospect_number', 'opportunity_name', 'company_name',
            'actor', 'actor_name', 'action', 'from_stage', 'to_stage', 'note',
            'attachment_count', 'attachments', 'created_at',
        ]
        read_only_fields = fields

    def get_attachment_count(self, obj):
        cached = getattr(obj, '_prefetched_objects_cache', {}).get('attachments')
        if cached is not None:
            return len(cached)
        return obj.attachments.count()


class ReminderSerializer(serializers.ModelSerializer):
    opportunity_name = serializers.CharField(source='opportunity.name', read_only=True)
    contact_name = serializers.CharField(source='contact.name', read_only=True)

    class Meta:
        model = Reminder
        fields = [
            'id', 'title', 'reminder_type', 'status', 'due_date', 'description',
            'opportunity', 'opportunity_name', 'contact', 'contact_name',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class PulseAssigneeSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()
    role = serializers.CharField()


class HighValueInfoSerializer(serializers.Serializer):
    threshold = serializers.IntegerField(default=HIGH_VALUE_INR)
