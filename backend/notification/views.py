from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
from .models import Notification


@api_view(['POST'])
@permission_classes([AllowAny])
def create_notification(request):
    """API view to create a notification manually."""
    serializer_data = request.data
    recipient_contact = serializer_data.get('recipient_contact')
    message = serializer_data.get('message')
    subject = serializer_data.get('subject', 'SLC Seek & Balik Notification')
    notification_type = serializer_data.get('notification_type', 'EMAIL')

    if not recipient_contact or not message:
        return Response(
            {"error": "recipient_contact and message are required fields."},
            status=status.HTTP_400_BAD_REQUEST
        )

    notification = Notification.objects.create(
        recipient_contact=recipient_contact,
        message=message,
        subject=subject,
        notification_type=notification_type
    )

    return Response(
        {
            "id": notification.id,
            "recipient_contact": notification.recipient_contact,
            "message": notification.message,
            "status": "Created"
        },
        status=status.HTTP_201_CREATED
    )


@api_view(['GET'])
@permission_classes([AllowAny])
def get_notification(request):
    """API view to retrieve notifications."""
    notifications = Notification.objects.all().order_by('-id')[:50]
    data = [
        {
            "id": n.id,
            "recipient_contact": n.recipient_contact,
            "message": n.message,
            "subject": getattr(n, 'subject', ''),
            "notification_type": getattr(n, 'notification_type', 'EMAIL')
        }
        for n in notifications
    ]
    return Response(data, status=status.HTTP_200_OK)


@api_view(['PUT', 'PATCH'])
@permission_classes([AllowAny])
def update_notification(request, pk=None):
    """API view to update a notification."""
    try:
        notification = Notification.objects.get(pk=pk)
    except Notification.DoesNotExist:
        return Response({"error": "Notification not found"}, status=status.HTTP_404_NOT_FOUND)

    message = request.data.get('message')
    if message:
        notification.message = message
        notification.save()

    return Response({"message": "Notification updated successfully."}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([AllowAny])
def report_item_public(request):
    """API view to handle public item reporting."""
    serializer_data = request.data
    recipient_contact = serializer_data.get('recipient_contact')
    message = serializer_data.get('message', 'A public item report was submitted.')
    subject = serializer_data.get('subject', 'Public Item Report')

    if not recipient_contact:
        return Response(
            {"error": "recipient_contact is required."},
            status=status.HTTP_400_BAD_REQUEST
        )

    notification = Notification.objects.create(
        recipient_contact=recipient_contact,
        message=message,
        subject=subject,
        notification_type='EMAIL'
    )

    return Response(
        {"message": "Report submitted successfully.", "id": notification.id},
        status=status.HTTP_201_CREATED
    )