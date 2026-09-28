from django.contrib import admin
from apps.pulse.models import (
    Opportunity,
    OpportunityActivity,
    OpportunityActivityAttachment,
    PulseContact,
    Reminder,
)

admin.site.register(PulseContact)
admin.site.register(Opportunity)
admin.site.register(OpportunityActivity)
admin.site.register(OpportunityActivityAttachment)
admin.site.register(Reminder)
