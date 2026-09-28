from rest_framework import serializers
from .models import Deal, DealActivity, PoWorkflow
from .services.deal_service import set_default_probability


class DealActivitySerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.name', read_only=True)

    class Meta:
        model = DealActivity
        fields = [
            'id', 'deal', 'type', 'subject', 'description',
            'activity_date', 'created_by', 'created_by_name', 'created_at'
        ]
        read_only_fields = ['id', 'created_by', 'created_by_name', 'created_at']
        extra_kwargs = {
            'deal': {'required': False},
        }

    def validate(self, attrs):
        view = self.context.get('view')
        nested_deal_id = getattr(view, 'kwargs', {}).get('deal_id') if view else None
        if not attrs.get('deal') and not nested_deal_id:
            raise serializers.ValidationError({'deal': 'This field is required.'})
        return attrs


class DealListSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source='company.name', read_only=True)
    owner_name = serializers.CharField(source='owner.name', read_only=True)
    weighted_value = serializers.ReadOnlyField()

    class Meta:
        model = Deal
        fields = [
            'id', 'name', 'company', 'company_name', 'value', 'currency',
            'stage', 'probability', 'weighted_value',
            'expected_close_date', 'owner', 'owner_name',
            'source', 'service_pillar', 'sub_category',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'weighted_value', 'created_at', 'updated_at']


class DealDetailSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source='company.name', read_only=True)
    owner_name = serializers.CharField(source='owner.name', read_only=True)
    weighted_value = serializers.ReadOnlyField()
    activities = DealActivitySerializer(many=True, read_only=True)

    class Meta:
        model = Deal
        fields = [
            'id', 'company', 'company_name', 'name', 'description',
            'value', 'currency', 'stage', 'probability', 'weighted_value',
            'expected_close_date', 'owner', 'owner_name',
            'source', 'service_pillar', 'sub_category',
            'notes', 'activities', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'weighted_value', 'created_at', 'updated_at']

    def validate(self, data):
        stage = data.get('stage')
        if stage and 'probability' not in data:
            data['probability'] = set_default_probability(stage)
        return data


class PoWorkflowSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source='company.name', read_only=True)
    customer_name_input = serializers.CharField(write_only=True, required=False, allow_blank=False)
    status = serializers.SerializerMethodField()
    po_display = serializers.SerializerMethodField()
    finance_approved = serializers.SerializerMethodField()
    opportunity_prospect_number = serializers.CharField(
        source='opportunity.prospect_number', read_only=True, allow_null=True,
    )
    opportunity_name = serializers.CharField(
        source='opportunity.name', read_only=True, allow_null=True,
    )
    opportunity_company_name = serializers.CharField(
        source='opportunity.company.name', read_only=True, allow_null=True,
    )

    class Meta:
        model = PoWorkflow
        fields = [
            'id', 'company', 'company_name', 'customer_name', 'customer_name_input',
            'billing_entity', 'service_pillar', 'po_number', 'po_display', 'po_date', 'agreement',
            'start_date', 'end_date', 'expiry', 'total_value', 'value_per_invoice',
            'billing_cycle', 'billing_due', 'status',
            'finance_approved', 'finance_approved_at', 'finance_purchase_order',
            'opportunity', 'opportunity_prospect_number', 'opportunity_name', 'opportunity_company_name',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'company', 'customer_name', 'po_display', 'status',
            'finance_approved', 'finance_approved_at', 'finance_purchase_order',
            'opportunity_prospect_number', 'opportunity_name', 'opportunity_company_name',
            'created_at', 'updated_at',
        ]
        extra_kwargs = {
            'po_date': {'required': False, 'allow_null': True},
            'start_date': {'required': False, 'allow_null': True},
            'end_date': {'required': False, 'allow_null': True},
            'expiry': {'required': False, 'allow_null': True},
            'total_value': {'required': False, 'allow_null': True},
            'value_per_invoice': {'required': False, 'allow_null': True},
            'opportunity': {'required': False, 'allow_null': True},
        }

    def to_internal_value(self, data):
        payload = data.copy() if hasattr(data, 'copy') else dict(data)
        if 'customer_name' in payload and 'customer_name_input' not in payload:
            payload['customer_name_input'] = payload.get('customer_name')
        for key in ('po_date', 'start_date', 'end_date', 'expiry', 'total_value', 'value_per_invoice'):
            if payload.get(key) == '':
                payload[key] = None
        return super().to_internal_value(payload)

    def get_status(self, obj):
        from apps.deals.po_service import po_status
        return po_status(obj)

    def get_po_display(self, obj):
        from apps.deals.po_service import po_display
        return po_display(obj)

    def get_finance_approved(self, obj):
        return bool(obj.finance_approved_at)
