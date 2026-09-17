import re

from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.tokens import RefreshToken

from django.contrib.auth import authenticate
from django.core.mail import send_mail
from django.conf import settings
from django.utils.crypto import get_random_string

from .models import Account
from .serializers import (
    AccountSerializer,
    AccountLoginSerializer,
    AccountLogoutSerializer,
)

SCHOOL_EMAIL_REGEX = re.compile(
    r"^\d{1,8}@slc-sflu\.edu\.ph$",
    re.IGNORECASE
)


# =========================================================
# SINGLE-ADMIN ENFORCEMENT HELPER
# =========================================================
def _deactivate_other_admins(keep_account):
    """
    Ensures at most one admin account is the CURRENT admin. Called
    immediately at creation/promotion time so the swap is authoritative
    and instant — the previous admin does NOT stay "current" until
    someone logs in again, and cannot silently reclaim current-admin
    status afterward.

    IMPORTANT: this touches is_current_admin ONLY, never is_active.
    Account.save() forces is_active=True for every admin. Using
    .update(is_active=False) here (as a previous version of this
    function did) bypasses save() entirely and produces an account
    stuck as role="admin", is_active=False — a state the model itself
    says is invalid, and one that permanently locks that admin out of
    login, since login() rejects is_active=False before authenticate()
    ever runs. is_current_admin=False just means "not the current one";
    the account can still log in completely normally.
    """
    Account.objects.filter(role="admin").exclude(pk=keep_account.pk).update(
        is_current_admin=False
    )


# =========================================================
# CREATE ACCOUNT HELPER
# =========================================================
def _create_account_helper(request_data, forced_role=None):
    data = request_data.copy()

    generated_password = get_random_string(
        12,
        allowed_chars="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*"
    )

    if not data.get("password"):
        data["password"] = generated_password
        data["must_change_password"] = True

    if not data.get("username"):
        data["username"] = data.get("email")

    if forced_role:
        data["role"] = forced_role

    serializer = AccountSerializer(data=data)

    if serializer.is_valid():
        account = serializer.save()

        # ===========================
        # ONLY ONE CURRENT ADMIN
        # ===========================
        # A new admin becomes the current admin immediately (the model
        # field defaults is_current_admin=True on creation); every other
        # existing admin is displaced right now via is_current_admin.
        # This new admin's own ability to log in is never touched by
        # this — is_active stays True the whole time.
        if account.role == "admin":
            _deactivate_other_admins(account)

        full_name = f"{account.first_name} {account.last_name}".strip()

        email_sent = True
        email_error = None

        if account.must_change_password:
            subject = "Your SLC Seek & Balik Account Password"

            message = f"""
Hello {full_name},

Your Seek & Balik account has been created.

Email:
{account.email}

Temporary Password:
{generated_password}

Please login immediately and change your password.

Student Affairs Office
Saint Louis College
"""

            try:
                send_mail(
                    subject,
                    message,
                    settings.DEFAULT_FROM_EMAIL,
                    [account.email],
                    fail_silently=False,
                )
            except Exception as e:
                email_sent = False
                email_error = str(e)
                print("Welcome email failed:", e)

        response_data = AccountSerializer(account).data
        response_data["email_sent"] = email_sent

        if email_error:
            response_data["email_error"] = email_error

        return Response(response_data, status=status.HTTP_201_CREATED)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# =========================================================
# PUBLIC REGISTER
# =========================================================
@api_view(["POST"])
@permission_classes([AllowAny])
def register(request):

    email = (request.data.get("email") or "").strip()

    if not SCHOOL_EMAIL_REGEX.match(email):
        return Response(
            {
                "email": [
                    "Use your School ID email (23100094@slc-sflu.edu.ph)."
                ]
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    return _create_account_helper(request.data, forced_role="student")


# =========================================================
# LOGIN
# =========================================================
@api_view(["POST"])
@permission_classes([AllowAny])
def login(request):

    serializer = AccountLoginSerializer(data=request.data)

    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    login_id = serializer.validated_data["username"]
    password = serializer.validated_data["password"]

    account = (
        Account.objects.filter(username=login_id).first()
        or Account.objects.filter(email=login_id).first()
    )

    if account is None:
        return Response(
            {"error": "Invalid credentials"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if account.is_archived:
        return Response(
            {"error": "This account has been archived."},
            status=status.HTTP_403_FORBIDDEN,
        )

    # For admins, is_active is always True (enforced in Account.save()),
    # so this check never blocks an admin login. For moderator/student/
    # employee accounts this is a genuine manual active/inactive toggle
    # and is respected here as before. The single-admin swap uses
    # is_current_admin exclusively and has no bearing on this check.
    if not account.is_active:
        return Response(
            {"error": "This account is inactive."},
            status=status.HTTP_403_FORBIDDEN,
        )

    user = authenticate(
        request,
        username=account.username,
        password=password,
    )

    if user is None:
        return Response(
            {"error": "Invalid credentials"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    refresh = RefreshToken.for_user(user)

    return Response(
        {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": AccountSerializer(user).data,
        },
        status=status.HTTP_200_OK,
    )


# =========================================================
# CHANGE PASSWORD
# =========================================================
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def change_password(request):

    user = request.user

    current_password = request.data.get("current_password", "")
    new_password = request.data.get("new_password", "")

    if not new_password:
        return Response(
            {"error": "New password is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if len(new_password) < 12 or len(new_password) > 16:
        return Response(
            {"error": "Password must be 12-16 characters long."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if any(c.isspace() for c in new_password):
        return Response(
            {"error": "Password must not contain spaces."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if user.check_password(new_password):
        return Response(
            {"error": "New password cannot match current password."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not user.must_change_password:
        if not current_password:
            return Response(
                {"error": "Current password required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not user.check_password(current_password):
            return Response(
                {"error": "Current password incorrect."},
                status=status.HTTP_400_BAD_REQUEST,
            )

    user.set_password(new_password)
    user.must_change_password = False
    user.save()

    return Response(
        {"message": "Password changed successfully."},
        status=status.HTTP_200_OK,
    )


# =========================================================
# LOGOUT
# =========================================================
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout(request):

    serializer = AccountLogoutSerializer(data=request.data)

    if serializer.is_valid():
        try:
            token = RefreshToken(serializer.validated_data["refresh"])
            token.blacklist()

            return Response(
                {"message": "Logout successful"},
                status=status.HTTP_205_RESET_CONTENT,
            )

        except Exception:
            return Response(
                {"error": "Invalid refresh token."},
                status=status.HTTP_400_BAD_REQUEST,
            )

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# =========================================================
# REFRESH TOKEN
# =========================================================
@api_view(["POST"])
@permission_classes([AllowAny])
def refresh_token(request):

    try:
        refresh = request.data.get("refresh")

        if not refresh:
            return Response(
                {"error": "Refresh token required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        token = RefreshToken(refresh)

        return Response(
            {"access": str(token.access_token)},
            status=status.HTTP_200_OK,
        )

    except Exception:
        return Response(
            {"error": "Invalid refresh token."},
            status=status.HTTP_400_BAD_REQUEST,
        )


# =========================================================
# CURRENT USER
# =========================================================
# GET  -> return the logged-in user's own account details.
# PATCH -> self-service partial update of the logged-in user's own
#          account (used by UserProfile.jsx's "Edit Profile" -> Save).
#          This always acts on request.user rather than a pk from the
#          URL, so a user can only ever edit their own account this
#          way — never someone else's by guessing an id, unlike
#          update_user() below which is the admin-editing-another-user
#          path and takes an explicit pk.
@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def current_user(request):

    if request.method == "GET":
        return Response(
            AccountSerializer(request.user).data,
            status=status.HTTP_200_OK,
        )

    # PATCH
    serializer = AccountSerializer(
        request.user,
        data=request.data,
        partial=True,
    )

    if serializer.is_valid():
        account = serializer.save()

        # Mirrors update_user()'s admin-promotion handling below, in
        # case AccountSerializer ever exposes `role` as writable here.
        # IMPORTANT: verify AccountSerializer marks role/is_active/
        # is_current_admin/username as read_only_fields — this view has
        # no pk-based restriction, so any authenticated user hitting
        # this endpoint could otherwise edit those fields on their own
        # account (e.g. self-promote to admin) via the request body.
        if account.role == "admin":
            if not account.is_current_admin:
                account.is_current_admin = True
                account.save(update_fields=["is_current_admin"])
            _deactivate_other_admins(account)

        return Response(AccountSerializer(account).data)

    return Response(
        serializer.errors,
        status=status.HTTP_400_BAD_REQUEST,
    )


# =========================================================
# USERS
# =========================================================
@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def get_user(request):

    if request.method == "GET":
        users = Account.objects.all().order_by("-id")
        serializer = AccountSerializer(users, many=True)
        return Response(serializer.data)

    # CREATE USER — admin creation displaces the previous current admin
    # via is_current_admin (handled inside _create_account_helper).
    data = request.data.copy()

    return _create_account_helper(data)


# =========================================================
# UPDATE / DELETE USER
# =========================================================
@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def update_user(request, pk):

    try:
        user = Account.objects.get(pk=pk)
    except Account.DoesNotExist:
        return Response(
            {"error": "User not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    if request.method == "GET":
        return Response(AccountSerializer(user).data)

    # UPDATE USER
    if request.method == "PUT":

        data = request.data.copy()

        serializer = AccountSerializer(
            user,
            data=data,
            partial=True
        )

        if serializer.is_valid():
            account = serializer.save()

            # Promoting someone into the admin role makes them the
            # current admin immediately and displaces whoever held that
            # status before, same as at creation time. is_active is
            # never touched here — Account.save() forces it True for
            # any admin regardless of what this view does.
            if account.role == "admin":
                if not account.is_current_admin:
                    account.is_current_admin = True
                    account.save(update_fields=["is_current_admin"])
                _deactivate_other_admins(account)

            return Response(AccountSerializer(account).data)

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST,
        )

    # DELETE USER
    if request.method == "DELETE":

        if user.role == "admin":
            return Response(
                {"error": "The system administrator cannot be deleted."},
                status=status.HTTP_403_FORBIDDEN,
            )

        user.delete()

        return Response(
            {"message": "User deleted successfully."},
            status=status.HTTP_200_OK,
        )