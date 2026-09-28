import uuid as uuid_lib
from pathlib import Path

from django.conf import settings
from rest_framework import serializers
from .models import FinancialPeriod, FinancialDocument, FinancialMetric, METRIC_CODES, MisUpload
from .models import (
    CapitalEntry,
    CashflowEntry,
    ComplianceItem,
    Invoice,
    Payable,
    PurchaseOrder,
)
from .services.metric_service import update_manual_metric, validate_metric_value


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
        read_only_fields = ['id', 'created_at', 'is_manual']

    def validate_metric_code(self, value):
        if value not in METRIC_CODES:
            raise serializers.ValidationError(
                f'Invalid metric code. Allowed: {", ".join(METRIC_CODES)}'
            )
        return value

    def validate_value(self, value):
        try:
            return validate_metric_value(value)
        except ValueError as exc:
            raise serializers.ValidationError(str(exc)) from exc

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
            existing.is_manual = True
            existing.save()
            return existing
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data.pop('financial_period', None)
        validated_data.pop('metric_code', None)
        validated_data.pop('source_document', None)
        if 'currency' in validated_data:
            instance.currency = validated_data['currency']
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        value = validated_data.get('value', instance.value)
        return update_manual_metric(instance, value, user=user)


class PurchaseOrderSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source='company.name', read_only=True)
    invoiced_value = serializers.SerializerMethodField()
    remaining_value = serializers.SerializerMethodField()
    progress = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseOrder
        fields = [
            'id', 'po_number', 'company', 'company_name', 'customer_name',
            'billing_entity', 'service_category', 'description',
            'po_date', 'start_date', 'end_date', 'total_value',
            'monthly_billing', 'billing_cycle', 'status', 'notes',
            'invoiced_value', 'remaining_value', 'progress', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'created_at', 'updated_at', 'company_name',
            'invoiced_value', 'remaining_value', 'progress',
        ]

    def get_invoiced_value(self, obj):
        total = sum((inv.amount for inv in obj.invoices.all()), 0)
        return float(total)

    def get_remaining_value(self, obj):
        remaining = float(obj.total_value) - self.get_invoiced_value(obj)
        return remaining if remaining > 0 else 0.0

    def get_progress(self, obj):
        total = float(obj.total_value or 0)
        if total <= 0:
            return 0.0
        return min(100.0, round((self.get_invoiced_value(obj) / total) * 100, 1))


class InvoiceSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source='company.name', read_only=True)
    po_number = serializers.CharField(source='purchase_order.po_number', read_only=True)
    balance = serializers.SerializerMethodField()
    gross_payable = serializers.SerializerMethodField()
    net_payable = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = [
            'id', 'invoice_number', 'purchase_order', 'po_number',
            'company', 'company_name', 'customer_name', 'amount',
            'taxable_amount', 'gst_amount', 'tds_amount', 'tds_section',
            'amount_received', 'balance', 'gross_payable', 'net_payable',
            'invoice_date', 'due_date', 'received_date',
            'status', 'notes', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'created_at', 'updated_at', 'company_name', 'po_number',
            'balance', 'gross_payable', 'net_payable',
        ]

    def get_balance(self, obj):
        return float(obj.balance)

    def get_gross_payable(self, obj):
        taxable = obj.taxable_amount or 0
        gst = obj.gst_amount or 0
        if taxable or gst:
            return float(taxable + gst)
        return float(obj.amount)

    def get_net_payable(self, obj):
        return float(self.get_gross_payable(obj) - float(obj.tds_amount or 0))


class PayableSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payable
        fields = [
            'id', 'vendor', 'category', 'invoice_number', 'month_label',
            'taxable_amount', 'gst_amount', 'tds_amount', 'total_amount', 'payable_amount',
            'due_date', 'status', 'notes', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class CashflowEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = CashflowEntry
        fields = [
            'id', 'entry_date', 'direction', 'bucket', 'category', 'sub_category',
            'entity', 'voucher_no', 'amount', 'notes', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class CapitalEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = CapitalEntry
        fields = [
            'id', 'capital_type', 'counterparty', 'amount', 'entry_date',
            'status', 'notes', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


MIS_MAX_BYTES = 10 * 1024 * 1024


class MisUploadSerializer(serializers.ModelSerializer):
    file = serializers.FileField(write_only=True)
    uploaded_by_name = serializers.CharField(source='uploaded_by.name', read_only=True)
    import_result = serializers.SerializerMethodField()

    class Meta:
        model = MisUpload
        fields = [
            'id', 'file', 'file_name', 'file_type', 'byte_size', 'storage_path',
            'uploaded_by', 'uploaded_by_name', 'import_result', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'file_name', 'file_type', 'byte_size', 'storage_path',
            'uploaded_by', 'uploaded_by_name', 'import_result', 'created_at', 'updated_at',
        ]

    def get_import_result(self, obj):
        return self.context.get('import_result')

    def validate_file(self, upload):
        name = (upload.name or '').lower()
        if not name.endswith('.xlsx'):
            raise serializers.ValidationError('Only .xlsx files are accepted.')
        size = getattr(upload, 'size', None) or 0
        if size > MIS_MAX_BYTES:
            raise serializers.ValidationError('File is too large (max 10 MB).')
        return upload

    def create(self, validated_data):
        from apps.finance.mis_import import import_mis_workbook

        upload = validated_data.pop('file')
        dest_dir = Path(settings.MEDIA_ROOT) / 'mis'
        dest_dir.mkdir(parents=True, exist_ok=True)
        stored_name = f'{uuid_lib.uuid4()}_{Path(upload.name).name}'
        dest_path = dest_dir / stored_name
        byte_size = 0
        chunks = []
        with dest_path.open('wb+') as destination:
            for chunk in upload.chunks():
                destination.write(chunk)
                chunks.append(chunk)
                byte_size += len(chunk)
        content = b''.join(chunks)
        instance = MisUpload.objects.create(
            file_name=Path(upload.name).name[:255],
            file_type='xlsx',
            byte_size=byte_size,
            storage_path=f'mis/{stored_name}',
            **validated_data,
        )
        self.context['import_result'] = import_mis_workbook(content)
        return instance


class ComplianceItemSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.name', read_only=True)
    due_date_scope = serializers.ChoiceField(
        choices=['this_month', 'recurring'],
        default='this_month',
        write_only=True,
        required=False,
    )

    class Meta:
        model = ComplianceItem
        fields = [
            'id', 'title', 'form_name', 'applicable_act', 'period_month',
            'due_date', 'due_date_note', 'status', 'notes',
            'due_date_scope',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_by', 'created_by_name', 'created_at', 'updated_at']

    def validate(self, data):
        period = data.get('period_month') or getattr(self.instance, 'period_month', None)
        if period is not None and period.day != 1:
            data['period_month'] = period.replace(day=1)
        return data

    def update(self, instance, validated_data):
        from calendar import monthrange

        scope = validated_data.pop('due_date_scope', 'this_month')
        due_date_in_payload = 'due_date' in validated_data
        new_due = validated_data.get('due_date') if due_date_in_payload else instance.due_date
        instance = super().update(instance, validated_data)

        form = (instance.form_name or '').strip()
        if (
            scope == 'recurring'
            and due_date_in_payload
            and new_due is not None
            and form
        ):
            day = new_due.day
            siblings = (
                ComplianceItem.objects.filter(
                    form_name__iexact=form,
                    applicable_act=instance.applicable_act,
                )
                .exclude(pk=instance.pk)
                .exclude(due_date__isnull=True)
            )
            to_update = []
            for sibling in siblings:
                last = monthrange(sibling.due_date.year, sibling.due_date.month)[1]
                shifted = sibling.due_date.replace(day=min(day, last))
                if shifted != sibling.due_date:
                    sibling.due_date = shifted
                    to_update.append(sibling)
            if to_update:
                ComplianceItem.objects.bulk_update(to_update, ['due_date'])

        return instance
