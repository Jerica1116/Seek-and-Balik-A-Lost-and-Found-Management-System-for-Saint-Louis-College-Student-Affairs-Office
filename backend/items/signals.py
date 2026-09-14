from django.db.models.signals import pre_save, post_save
from django.dispatch import receiver
from .models import ItemDetails
from notification.service import send_item_status_notification

@receiver(pre_save, sender=ItemDetails)
def track_item_status_before_save(sender, instance, **kwargs):
    if instance.pk:
        try:
            previous_instance = ItemDetails.objects.get(pk=instance.pk)
            instance._old_status = previous_instance.status
        except ItemDetails.DoesNotExist:
            instance._old_status = None
    else:
        instance._old_status = None

@receiver(post_save, sender=ItemDetails)
def trigger_notification_on_status_change(sender, instance, created, **kwargs):
    if created:
        return

    old_status = getattr(instance, '_old_status', None)

    if old_status and old_status != instance.status:
        try:
            send_item_status_notification(instance)
        except Exception as error:
            print(f"[Signal Warning] Email dispatch failed: {error}")