from django.utils import timezone
from django.db import models
from django.contrib.auth.models import AbstractUser


class Account(AbstractUser):
    ROLE_CHOICES = [
        ("admin", "Admin"),
        ("moderator", "Moderator"),
        ("student", "Student"),
        ("employee", "Employee"),   # NEW
    ]

    # Login email
    email = models.EmailField(unique=True)

    # Contact number
    contact_number = models.CharField(max_length=20, blank=True, null=True)

    # User role
    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default="student"
    )

    # Account status
    is_archived = models.BooleanField(default=False)
    must_change_password = models.BooleanField(default=False)

    # NEW — temporary password issued by admin
    has_temporary_password = models.BooleanField(default=False)

    # NEW — tracks which ONE admin is currently "the" admin, separate
    # from is_active. is_active is forced True for every admin below (an
    # admin must always be able to log in); is_current_admin is what the
    # single-admin swap logic in views.py actually flips.
    #
    # IMPORTANT: never set is_active=False on an admin anywhere in this
    # codebase. Doing so fights the rule directly below (is_active is
    # forced True whenever role == "admin" is saved) and produces an
    # account stuck as role="admin", is_active=False — a state this model
    # says is invalid, and one that permanently locks that admin out of
    # login, since login() rejects is_active=False before authenticate()
    # ever runs. This was a real bug that shipped here previously.
    is_current_admin = models.BooleanField(default=True)

    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        """
        SEEK & BALIK ACCOUNT RULES

        ✔ Email is always username.
        ✔ Only ONE admin account is the CURRENT admin at a time —
          enforced via is_current_admin, NEVER is_active. Every admin
          account can always log in; is_current_admin just decides which
          one the UI treats as "the" active admin.
        ✔ Superuser is always admin.

        NOTE: Single-admin swap enforcement happens in views.py via
        _deactivate_other_admins(), which updates is_current_admin (not
        is_active) on every other admin, and runs right after a new or
        promoted admin is saved. Do NOT force is_current_admin here in
        save() — unlike is_active and is_archived below, its correct
        value depends on WHY save() is being called (new admin vs. an
        unrelated field edit vs. the swap itself), which this method has
        no way to know. That decision belongs in the view layer.
        """

        # Username always mirrors email
        if self.email:
            self.email = self.email.lower().strip()
            self.username = self.email

        # Django superuser is forced admin
        if self.is_superuser:
            self.role = "admin"

        if self.role == "admin":
            # Admin can never be archived or inactive — this means
            # is_active must NEVER be used to gate the admin swap.
            # Use is_current_admin for that instead.
            self.is_archived = False
            self.is_active = True

        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.role})"

    # Convenience properties
    @property
    def is_admin(self):
        return self.role == "admin"

    @property
    def is_moderator(self):
        return self.role == "moderator"

    @property
    def is_student(self):
        return self.role == "student"

    @property
    def is_employee(self):
        return self.role == "employee"