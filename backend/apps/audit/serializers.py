from rest_framework import serializers

from .models import ImportLog


class ImportLogSerializer(serializers.ModelSerializer):
    module_label = serializers.CharField(source='get_module_display', read_only=True)
    uploaded_by_name = serializers.SerializerMethodField()
    uploaded_by_email = serializers.SerializerMethodField()
    has_file = serializers.SerializerMethodField()

    class Meta:
        model = ImportLog
        fields = [
            'id', 'module', 'module_label', 'file_name', 'byte_size', 'has_file',
            'uploaded_by', 'uploaded_by_name', 'uploaded_by_email',
            'created_count', 'updated_count', 'error_count', 'warning_count', 'created_at',
        ]
        read_only_fields = fields

    def get_uploaded_by_name(self, obj):
        return obj.uploaded_by.name if obj.uploaded_by else ''

    def get_uploaded_by_email(self, obj):
        return obj.uploaded_by.email if obj.uploaded_by else ''

    def get_has_file(self, obj):
        return bool(obj.file)


class ImportLogDetailSerializer(ImportLogSerializer):
    class Meta(ImportLogSerializer.Meta):
        fields = ImportLogSerializer.Meta.fields + ['errors', 'warnings']
        read_only_fields = fields
