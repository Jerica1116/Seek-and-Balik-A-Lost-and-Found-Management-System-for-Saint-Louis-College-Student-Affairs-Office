from django.db import models
from items.models import ItemDetails


class AvailableSchedule(models.Model):
    date = models.DateField()
    time_slot = models.CharField(max_length=50)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ("date", "time_slot")
        ordering = ["date", "time_slot"]

    def __str__(self):
        return f"{self.date} @ {self.time_slot}"


class Claim(models.Model):
    STATUS_CHOICES = [
        ("Pending", "Pending"),
        ("Scheduled", "Scheduled"),
        ("Completed", "Completed"),
        ("Rejected", "Rejected"),
        ("Cancelled", "Cancelled"),
    ]

    item = models.ForeignKey(
        ItemDetails,
        on_delete=models.CASCADE,
        related_name="claims",
    )

    claimant_name = models.CharField(max_length=100)
    claimant_contact = models.CharField(max_length=30)
    claimant_email = models.EmailField()

    proof_description = models.TextField(max_length=500)

    claim_date = models.DateTimeField(auto_now_add=True)

    meeting_date = models.DateField(null=True, blank=True)
    meeting_time = models.CharField(max_length=50, null=True, blank=True)

    # FIX: previously had a `default="Student Affairs Office"` but no
    # `blank=True`. A model/serializer `default` only applies when a
    # field is entirely ABSENT from the input — it does NOT apply when
    # the field is explicitly submitted as "". Without blank=True, DRF
    # rejects an explicit "" at validation time with "This field may
    # not be blank," before the default ever gets a chance to kick in.
    #
    # ClaimModal.jsx submits meeting_location: "" for every claim
    # (staff fill in the real location later when they confirm the
    # meeting via ClaimRequests.jsx), so every single claim submission
    # was 400ing here — this is what caused "Claim submission failed"
    # with server response {"meeting_location": ["This field may not
    # be blank."]}. blank=True makes the backend accept the empty
    # string; the default value then still applies through normal
    # model-level save() behavior for anything that omits the field
    # outright (e.g. a future non-frontend caller of the API).
    meeting_location = models.CharField(
        max_length=100,
        default="Student Affairs Office",
        blank=True,
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="Pending"
    )

    # --------------------------------------------------------------
    # OWNERSHIP Q&A
    #
    # ClaimModal.jsx has always submitted question_1..4 / answer_1..4
    # (the ownership verification questions and the claimant's typed/
    # selected answers) plus other_description and needs_manual_review,
    # but nothing on this model captured them — a plain ModelSerializer
    # silently drops any submitted key that isn't a declared field, so
    # every claim was losing this data on save. ClaimRequests.jsx's
    # "Automated Answer Check" panel and the Needs Attention / Scheduled
    # split both depend on these actually being persisted.
    # --------------------------------------------------------------

    question_1 = models.CharField(max_length=255, blank=True, default="")
    answer_1 = models.CharField(max_length=255, blank=True, default="")

    question_2 = models.CharField(max_length=255, blank=True, default="")
    answer_2 = models.CharField(max_length=255, blank=True, default="")

    question_3 = models.CharField(max_length=255, blank=True, default="")
    answer_3 = models.CharField(max_length=255, blank=True, default="")

    question_4 = models.CharField(max_length=255, blank=True, default="")
    answer_4 = models.CharField(max_length=255, blank=True, default="")

    # Optional free-text extra context from the claimant (ClaimModal.jsx's
    # "Other Unique Description" field). Never required, never gates
    # anything.
    other_description = models.TextField(max_length=300, blank=True, default="")

    # Set by ClaimModal.jsx when the live verify-answers check came back
    # mismatched (or couldn't be resolved) at submission time, so staff
    # can distinguish "no schedule because generic/unauto-checkable
    # questions" from "no schedule because an answer was actually wrong" —
    # even after a schedule is later added, this flag (and the recorded-
    # answer comparison it feeds) still shows the mismatch history.
    needs_manual_review = models.BooleanField(default=False)

    # --------------------------------------------------------------
    # STAFF-CONFIRMED SCHEDULE FLAG
    #
    # True only when a moderator/admin explicitly confirms a meeting
    # through ClaimRequests.jsx's Review -> Continue to Schedule ->
    # Confirm Schedule flow (send() there calls scheduleMeeting() with
    # staff_scheduled: true). A claimant can also end up with
    # meeting_date/meeting_time set on their own, by self-picking a slot
    # in ClaimModal.jsx when their verification answers matched — that
    # path never sets this flag, so it stays False.
    #
    # Dashboard.jsx's ClaimScheduleCalendar (isStaffConfirmedSchedule)
    # only counts claims where this is True, so it must be persisted
    # here and included in ClaimSerializer's fields, or every "Confirm
    # Schedule" action silently fails to show up on that calendar.
    # --------------------------------------------------------------
    staff_scheduled = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.claimant_name} - {self.item.title}"