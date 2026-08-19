from django.contrib import admin
from .models import Company, Contact


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ['name', 'status', 'industry', 'location', 'owner', 'created_at']
    list_filter = ['status', 'industry']
    search_fields = ['name', 'industry', 'location']
    ordering = ['name']
    raw_id_fields = ['owner']


@admin.register(Contact)
class ContactAdmin(admin.ModelAdmin):
    list_display = ['full_name', 'company', 'designation', 'email', 'phone']
    list_filter = ['company']
    search_fields = ['first_name', 'last_name', 'email', 'company__name']
    ordering = ['first_name', 'last_name']
    raw_id_fields = ['company']