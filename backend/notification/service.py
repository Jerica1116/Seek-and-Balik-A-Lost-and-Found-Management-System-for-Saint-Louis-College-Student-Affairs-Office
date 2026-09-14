# notification/service.py
from django.core.mail import send_mail
from django.conf import settings


def send_item_status_notification(item_instance):
    poster_email = getattr(item_instance, 'poster_email', None) or getattr(item_instance, 'email', None)
    if not poster_email:
        return

    title = getattr(item_instance, 'title', 'Item')
    status = getattr(item_instance, 'status', '')
    poster_name = getattr(item_instance, 'poster_name', 'User')
    ticket_code = getattr(item_instance, 'ticket_code', 'N/A')

    if status == 'Approved':
        subject = f"[Seek & Balik] Item Status Update: {title} - Approved"
        message = (
            f"Hello {poster_name},\n\n"
            f"Your reported item '{title}' has been reviewed and APPROVED.\n"
            f"Ticket Code: {ticket_code}\n\n"
            f"Regards,\nSAO Office - Saint Louis College"
        )
    elif status == 'Claimed':
        subject = f"[Seek & Balik] Item Status Update: {title} - Claimed"
        message = (
            f"Hello {poster_name},\n\n"
            f"Your item '{title}' has been marked as CLAIMED.\n\n"
            f"Regards,\nSAO Office - Saint Louis College"
        )
    else:
        return

    send_mail(
        subject=subject,
        message=message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[poster_email],
        fail_silently=True,
    )


def send_new_report_notification(item_instance):
    """
    Sends the "your report was submitted" confirmation email.
    Called right after a new item is created via the Report Lost modal.
    """
    poster_email = getattr(item_instance, 'email', None)
    if not poster_email:
        return

    poster_name = getattr(item_instance, 'poster_name', 'User')
    ticket_code = getattr(item_instance, 'ticket_code', 'N/A')
    title = getattr(item_instance, 'title', 'Item')
    category = getattr(item_instance, 'category', '')
    location = getattr(item_instance, 'location', '')

    subject = f"[Seek & Balik] Lost Item Report Submitted - {ticket_code}"
    message = (
        f"Hello {poster_name},\n\n"
        f"Your lost item report has been successfully submitted.\n\n"
        f"Ticket Code: {ticket_code}\n\n"
        f"Item: {title}\n"
        f"Category: {category}\n"
        f"Location: {location}\n\n"
        f"Status: Pending Review\n\n"
        f"You can use this ticket code to track your report.\n\n"
        f"- SAO Office"
    )

    send_mail(
        subject=subject,
        message=message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[poster_email],
        fail_silently=False,
    )