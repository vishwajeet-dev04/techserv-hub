from rest_framework import serializers
from .models import Company, Contact
from apps.users.serializers import UserSerializer


class ContactSerializer(serializers.ModelSerializer):
    full_name = serializers.ReadOnlyField()

    class Meta:
        model = Contact
        fields = [
            'id', 'company', 'first_name', 'last_name', 'full_name',
            'designation', 'email', 'phone', 'linkedin_url',
            'notes', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'full_name', 'created_at', 'updated_at']
        extra_kwargs = {
            'company': {'required': False},
        }

    def validate(self, attrs):
        view = self.context.get('view')
        nested_company_id = getattr(view, 'kwargs', {}).get('company_id') if view else None
        if not attrs.get('company') and not nested_company_id:
            raise serializers.ValidationError({'company': 'This field is required.'})
        return attrs


class CompanyListSerializer(serializers.ModelSerializer):
    owner_name = serializers.CharField(source='owner.name', read_only=True)
    contact_count = serializers.SerializerMethodField()

    class Meta:
        model = Company
        fields = [
            'id', 'name', 'company_type', 'industry', 'website',
            'status', 'location', 'owner_name', 'contact_count',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_contact_count(self, obj):
        return obj.contacts.count()


class CompanyDetailSerializer(serializers.ModelSerializer):
    owner = UserSerializer(read_only=True)
    owner_id = serializers.UUIDField(write_only=True, required=False, allow_null=True)
    contacts = ContactSerializer(many=True, read_only=True)

    class Meta:
        model = Company
        fields = [
            'id', 'name', 'company_type', 'industry', 'website',
            'location', 'status', 'owner', 'owner_id',
            'notes', 'contacts', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']