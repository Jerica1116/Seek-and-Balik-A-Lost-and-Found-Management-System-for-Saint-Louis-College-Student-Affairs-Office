from rest_framework.permissions import BasePermission


class IsStaffMember(BasePermission):
    """
    Allows access only to authenticated Admin or Moderator accounts.

    Used to protect claim endpoints that expose an item's internal
    `description` (the staff-only ownership-verification reference) and
    other staff-facing claim management actions, so students/claimants
    can never reach them directly.
    """

    message = "Only Admin or Moderator staff can access this resource."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and getattr(user, "role", None) in ("admin", "moderator")
        )
