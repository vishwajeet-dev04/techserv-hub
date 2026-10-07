from django.urls import path

from apps.pulse import views

urlpatterns = [
    path('assignees/', views.pulse_assignees, name='pulse-assignees'),
    path('summary/', views.pulse_summary, name='pulse-summary'),
    path('pipeline/', views.pulse_pipeline, name='pulse-pipeline'),
    path('executive/', views.pulse_executive, name='pulse-executive'),
    path('team/', views.pulse_team, name='pulse-team'),
    path('settings/', views.pulse_settings, name='pulse-settings'),
    path('contacts/', views.PulseContactListCreateView.as_view(), name='pulse-contact-list'),
    path('contacts/export/', views.contacts_export, name='pulse-contact-export'),
    path('contacts/template/', views.contacts_template, name='pulse-contact-template'),
    path('contacts/import/', views.contacts_import, name='pulse-contact-import'),
    path('contacts/<uuid:pk>/', views.PulseContactDetailView.as_view(), name='pulse-contact-detail'),
    path('opportunities/', views.OpportunityListCreateView.as_view(), name='pulse-opportunity-list'),
    path('opportunities/export/', views.opportunities_export, name='pulse-opportunity-export'),
    path('opportunities/template/', views.opportunities_template, name='pulse-opportunity-template'),
    path('opportunities/import/', views.opportunities_import, name='pulse-opportunity-import'),
    path('opportunities/<uuid:pk>/created-at/', views.opportunity_created_at, name='pulse-opportunity-created-at'),
    path('opportunities/<uuid:pk>/', views.OpportunityDetailView.as_view(), name='pulse-opportunity-detail'),
    path('opportunities/<uuid:pk>/activities/', views.OpportunityActivityListView.as_view(), name='pulse-opportunity-activities'),
    path('opportunities/<uuid:pk>/documents/', views.opportunity_documents, name='pulse-opportunity-documents'),
    path('ops-updates/', views.OpsUpdateListView.as_view(), name='pulse-ops-updates'),
    path('attachments/<uuid:pk>/preview/', views.attachment_preview, name='pulse-attachment-preview'),
    path('reminders/', views.ReminderListCreateView.as_view(), name='pulse-reminder-list'),
    path('reminders/<uuid:pk>/', views.ReminderDetailView.as_view(), name='pulse-reminder-detail'),
    path('reminders/<uuid:pk>/done/', views.reminder_done, name='pulse-reminder-done'),
]
