from datetime import date, timedelta
from rest_framework import serializers
from .models import Claim, AvailableSchedule


# Fixed verification meeting time slots the claimant can choose from on the
# public Claim Modal. Kept identical to the TIME_OPTIONS list staff use in
# ClaimRequests.jsx and the DEFAULT_TIME_OPTIONS list in ClaimModal.jsx, so
# meeting_time values line up everywhere they're displayed.
#
# FIX: last slot previously read "4:00 AM - 5:00 AM", which didn't match
# either frontend's list (both use "4:00 PM - 5:00 PM" for the natural
# 1PM -> 4PM afternoon sequence). Any claimant submission that picked that
# slot failed validate() below with a 400 and was silently never created —
# it never reached Claim Requests, which looked identical to "claims aren't
# updating." Corrected to match.
ALLOWED_MEETING_TIME_SLOTS = [
    "8:00 AM - 9:00 AM",
    "9:00 AM - 10:00 AM",
    "10:00 AM - 11:00 AM",
    "11:00 AM - 12:00 PM",
    "1:00 PM - 2:00 PM",
    "2:00 PM - 3:00 PM",
    "3:00 PM - 4:00 PM",
    "4:00 PM - 5:00 PM",
]


class AvailableScheduleSerializer(serializers.ModelSerializer):
    class Meta:
        model = AvailableSchedule
        fields = "__all__"

    def validate_date(self, value):
        if value < date.today():
            raise serializers.ValidationError("Schedule date cannot be in the past.")
        return value


class ClaimSerializer(serializers.ModelSerializer):
    """
    NOTE on `item_details.description`:
    The found item's internal `description` (written by admin/moderator when
    logging the item) is the source of truth used to validate a claimant's
    ownership answers. It must never be shown to the claimant, so it is only
    attached here when the view explicitly marks the request as staff-facing
    via `context={"include_item_description": True}` (see claim/views.py:
    get_claim and schedule_meeting). create_claim never sets that flag, so the
    claimant's own submission response never includes it.

    NOTE on `item_details.verification_answer_N`:
    Same staff-only gating applies to the admin-recorded correct answer for
    each of the 4 ownership verification questions. Without these,
    ClaimRequests.jsx's getRecordedAnswer()/buildAnswerComparison() has
    nothing to compare the claimant's answers against, so a claim can never
    be flagged as a mismatch there — it can only ever land in "Needs
    Attention" via a blank meeting_date/time, never via an actually wrong
    answer. See get_item_details() below.

    NOTE on `staff_scheduled`:
    Set to True only when staff explicitly confirm a meeting through
    ClaimRequests.jsx's Review -> Continue to Schedule -> Confirm Schedule
    flow (send() there passes staff_scheduled: true to scheduleMeeting()).
    This distinguishes a staff-locked-in meeting from a claimant's own
    self-picked slot (a matched-answer submission from ClaimModal.jsx),
    since both populate meeting_date/meeting_time the same way.
    Dashboard.jsx's ClaimScheduleCalendar (isStaffConfirmedSchedule) only
    counts claims where this is True, so it must be a writable/readable
    field here or that value is silently dropped on every schedule update
    and the calendar never sees it.
    """

    item_details = serializers.SerializerMethodField()

    class Meta:
        model = Claim
        fields = [
            "id",
            "item",
            "item_details",
            "claimant_name",
            "claimant_contact",
            "claimant_email",
            "proof_description",
            "claim_date",
            "meeting_date",
            "meeting_time",
            "meeting_location",
            "status",
            "question_1",
            "answer_1",
            "question_2",
            "answer_2",
            "question_3",
            "answer_3",
            "question_4",
            "answer_4",
            "other_description",
            "needs_manual_review",
            "staff_scheduled",
        ]

    def get_item_details(self, obj):
        item = obj.item
        if not item:
            return None

        data = {
            "id": item.id,
            "title": item.title,
            "category": item.category,
            "location": item.location,
            "type": item.type,
            "status": item.status,
        }

        if self.context.get("include_item_description"):
            data["description"] = item.description

            # Staff-only: the admin-recorded correct answer for each
            # ownership verification question, so ClaimRequests.jsx's
            # getRecordedAnswer()/buildAnswerComparison() can actually
            # flag a mismatch instead of always seeing `null`. Never
            # exposed on the claimant-facing response — create_claim()
            # never sets include_item_description, so this block never
            # runs for the claimant's own submission.
            #
            # Same getattr fallback as verify_answers() in views.py:
            # tries verification_answer_N first, then correct_answer_N.
            #
            # ASSUMPTION: confirm these are ItemDetails' real field
            # names — update both here and in verify_answers() together
            # if the model uses something else.
            for n in range(1, 5):
                recorded = (
                    getattr(item, f"verification_answer_{n}", None)
                    or getattr(item, f"correct_answer_{n}", None)
                )
                data[f"verification_answer_{n}"] = recorded

        return data

    # ------------------------------------------------------------------
    # ClaimModal.jsx submits meeting_date/meeting_time as "" (empty
    # string) for a pending-review claim with no claimant-picked slot
    # yet — not omitted, not null, literally "". DRF's DateField only
    # treats an actually-missing key or an explicit None as "not set";
    # an empty string fails field-level parsing before validate() or
    # validate_meeting_date() ever runs, so the whole request 400s and
    # the claim is never created. Normalize both fields here, before
    # DRF's own field parsing, so a blank string is treated the same as
    # "not provided" instead of "invalid date".
    # ------------------------------------------------------------------
    def to_internal_value(self, data):
        data = data.copy() if hasattr(data, "copy") else dict(data)

        if data.get("meeting_date") == "":
            data["meeting_date"] = None
        if data.get("meeting_time") == "":
            data["meeting_time"] = None

        return super().to_internal_value(data)

    def validate_meeting_date(self, value):
        if value and value < date.today():
            raise serializers.ValidationError("Meeting date cannot be in the past.")
        return value

    def validate(self, data):
        """
        The claimant now picks any calendar date on the public Claim
        Modal (same freeform date input used on the Report Lost form) —
        it no longer has to match a staff-preset AvailableSchedule slot.
        Two rules still apply instead: the time must be one of the fixed
        daily slots, and the date must fall strictly after the date this
        item was surrendered/found.

        Both rules only apply once a meeting_date/meeting_time is
        actually present — a pending-review claim (mismatched/unverified
        answers) intentionally submits neither, and that's valid.

        (Staff-preset AvailableSchedule slots still exist and are used
        by ClaimRequests.jsx when staff confirm the final meeting time —
        this validate() only governs the claimant's initial submission.)
        """
        meeting_date = data.get("meeting_date")
        meeting_time = data.get("meeting_time")
        item = data.get("item")

        if meeting_time and meeting_time not in ALLOWED_MEETING_TIME_SLOTS:
            raise serializers.ValidationError({
                "meeting_time": "Please select one of the available time slots."
            })

        if meeting_date and item and item.created_date:
            earliest_allowed = item.created_date + timedelta(days=1)
            if meeting_date < earliest_allowed:
                raise serializers.ValidationError({
                    "meeting_date": (
                        "The verification meeting date must be after the date "
                        "this item was surrendered/found."
                    )
                })

        return data