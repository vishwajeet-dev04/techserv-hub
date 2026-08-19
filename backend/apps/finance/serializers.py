import uuid as uuid_lib
from pathlib import Path

from django.conf import settings
from rest_framework import serializers
from .models import FinancialPeriod, FinancialDocument, FinancialMetric, METRIC_CODES


class FinancialPeriodSerializer(serializers.ModelSerializer):
    class Meta:
        model = FinancialPeriod
        fields = ['id', 'period_type', 'start_date', 'end_date', 'label', 'created_at']
        read_only_fields = ['id', 'created_at']

    def validate(self, data):
        if data.get('start_date') and data.get('end_date'):
            if data['start_date'] > data['end_date']:
                raise serializers.ValidationError('Start date must be before end date.')
        return data


class FinancialDocumentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(source='uploaded_by.name', read_only=True)
    period_label = serializers.CharField(source='financial_period.label', read_only=True)

    class Meta:
        model = FinancialDocument
        fields = [
            'id', 'file_name', 'file_type', 'document_type',
            'financial_period', 'period_label',
            'uploaded_by', 'uploaded_by_name',
            'extraction_status', 'validation_status',
            'extraction_error', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'uploaded_by', 'extraction_status',
            'validation_status', 'extraction_error',
            'created_at', 'updated_at'
        ]


class FinancialDocumentUploadSerializer(serializers.ModelSerializer):
    file = serializers.FileField(write_only=True)
    uploaded_by_name = serializers.CharField(source='uploaded_by.name', read_only=True)
    period_label = serializers.CharField(source='financial_period.label', read_only=True)

    class Meta:
        model = FinancialDocument
        fields = [
            'id', 'file', 'file_name', 'file_type', 'document_type',
            'financial_period', 'period_label',
            'uploaded_by', 'uploaded_by_name',
            'extraction_status', 'validation_status',
            'extraction_error', 'storage_path',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'file_name', 'file_type', 'storage_path',
            'uploaded_by', 'extraction_status',
            'validation_status', 'extraction_error',
            'created_at', 'updated_at'
        ]

    def create(self, validated_data):
        upload = validated_data.pop('file')
        extension = Path(upload.name).suffix.lstrip('.')[:10] or 'bin'
        dest_dir = Path(settings.MEDIA_ROOT) / 'documents'
        dest_dir.mkdir(parents=True, exist_ok=True)
        stored_name = f'{uuid_lib.uuid4()}_{Path(upload.name).name}'
        dest_path = dest_dir / stored_name
        with dest_path.open('wb+') as destination:
            for chunk in upload.chunks():
                destination.write(chunk)

        return FinancialDocument.objects.create(
            file_name=upload.name,
            file_type=extension,
            storage_path=f'documents/{stored_name}',
            **validated_data
        )


class FinancialMetricSerializer(serializers.ModelSerializer):
    period_label = serializers.CharField(source='financial_period.label', read_only=True)

    class Meta:
        model = FinancialMetric
        fields = [
            'id', 'financial_period', 'period_label',
            'metric_code', 'value', 'currency',
            'source_document', 'source_reference',
            'confidence', 'is_manual', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']

    def validate_metric_code(self, value):
        if value not in METRIC_CODES:
            raise serializers.ValidationError(
                f'Invalid metric code. Allowed: {", ".join(METRIC_CODES)}'
            )
        return value

    def get_unique_together_validators(self):
        return []

    def create(self, validated_data):
        period = validated_data['financial_period']
        code = validated_data['metric_code']
        source = validated_data.get('source_document')
        qs = FinancialMetric.objects.filter(financial_period=period, metric_code=code)
        existing = (
            qs.filter(source_document__isnull=True).first()
            if source is None
            else qs.filter(source_document=source).first()
        )
        if existing:
            for key, value in validated_data.items():
                setattr(existing, key, value)
            existing.save()
            return existing
        return super().create(validated_data)