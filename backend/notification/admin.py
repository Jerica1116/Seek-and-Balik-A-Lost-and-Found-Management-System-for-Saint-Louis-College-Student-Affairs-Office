from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, LostItem, Notification


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('username', 'email', 'role', 'school_id', 'is_staff')
    list_filter = ('role', 'is_staff')
    fieldsets = BaseUserAdmin.fieldsets + (
        ('School Info', {'fields': ('role', 'school_id')}),
    )


@admin.register(LostItem)
class LostItemAdmin(admin.ModelAdmin):
    list_display = ('title', 'reporter', 'status', 'location_lost', 'date_lost', 'created_at')
    list_filter = ('status', 'date_lost')
    search_fields = ('title', 'description', 'reporter__email')


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('recipient_contact', 'notification_type', 'subject', 'is_sent', 'created_at')
    list_filter = ('notification_type', 'is_sent', 'created_at')
    search_fields = ('recipient_contact', 'subject', 'message')