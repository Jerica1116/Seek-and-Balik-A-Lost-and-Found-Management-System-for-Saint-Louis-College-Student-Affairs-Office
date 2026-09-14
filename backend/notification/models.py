from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import RegexValidator

# Validator enforcing exactly 8 digits before @slc-sflu.edu.ph
student_email_validator = RegexValidator(
    regex=r'^\d{8}@slc-sflu\.edu\.ph$',
    message="Email must be an 8-digit student email (e.g., 12345678@slc-sflu.edu.ph)."
)


class User(AbstractUser):
    class Role(models.TextChoices):
        STUDENT = 'STUDENT', 'Student'
        EMPLOYEE = 'EMPLOYEE', 'Employee'
        MODERATOR = 'MODERATOR', 'Moderator'
        ADMIN = 'ADMIN', 'Admin'

    email = models.EmailField(
        unique=True,
        validators=[student_email_validator],
        help_text="Format: 8 digits followed by @slc-sflu.edu.ph"
    )
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.STUDENT)
    school_id = models.CharField(max_length=50, unique=True, null=True, blank=True)

    # Added related_name arguments to fix E304 clashes with account.Account
    groups = models.ManyToManyField(
        'auth.Group',
        related_name='notification_user_set',
        blank=True,
        help_text='The groups this user belongs to.',
        verbose_name='groups',
    )
    user_permissions = models.ManyToManyField(
        'auth.Permission',
        related_name='notification_user_permissions_set',
        blank=True,
        help_text='Specific permissions for this user.',
        verbose_name='user permissions',
    )

    def is_moderator(self):
        return self.role == self.Role.MODERATOR


class LostItem(models.Model):
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending Approval'
        APPROVED = 'APPROVED', 'Approved'
        REJECTED = 'REJECTED', 'Rejected'
        CLAIMED = 'CLAIMED', 'Claimed'

    reporter = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reported_items')
    title = models.CharField(max_length=100)
    description = models.TextField()
    location_lost = models.CharField(max_length=100)
    date_lost = models.DateField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    rejection_reason = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.title} ({self.get_status_display()})"


class Notification(models.Model):
    class NotificationType(models.TextChoices):
        REPORT_SUBMITTED = 'REPORT', 'Report Submitted'
        APPROVED = 'APPROVED', 'Report Approved'
        REJECTED = 'REJECTED', 'Report Rejected'
        ACCOUNT = 'ACCOUNT', 'Account Update'
        SCHEDULED_REMINDER = 'SCHEDULED', 'Scheduled Reminder'

    recipient_contact = models.EmailField(
        max_length=255,
        validators=[student_email_validator]
    )
    notification_type = models.CharField(
        max_length=20, 
        choices=NotificationType.choices, 
        default=NotificationType.REPORT_SUBMITTED
    )
    subject = models.CharField(max_length=255, default="Lost & Found Notification")
    message = models.TextField()
    is_sent = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"[{self.notification_type}] To: {self.recipient_contact} - Sent: {self.is_sent}"