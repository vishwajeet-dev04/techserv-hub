from rest_framework import serializers
from .models import Deal, DealActivity
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
            'expected_close_date', 'owner', 'owner_name', 'created_at', 'updated_at'
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
            'source', 'notes', 'activities', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'weighted_value', 'created_at', 'updated_at']

    def validate(self, data):
        stage = data.get('stage')
        if stage and 'probability' not in data:
            data['probability'] = set_default_probability(stage)
        return data