from datetime import datetime
from django.core.mail import send_mail
from django.conf import settings
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from .models import Claim, AvailableSchedule
from .serializers import ClaimSerializer, AvailableScheduleSerializer
from .permissions import IsStaffMember
from items.models import ItemDetails

User = get_user_model()


# -------------------------------------------------------------------
# AVAILABLE SCHEDULE ENDPOINTS (Used by Admin & User Claim Modal)
# -------------------------------------------------------------------

@api_view(['GET', 'POST'])
def available_schedules(request):
    """
    GET: Fetch active schedule slots (used by ClaimModal.jsx and
    ClaimRequests.jsx). Accepts an optional ?date=YYYY-MM-DD query
    param to narrow results to a single day — ClaimModal.jsx uses this
    to populate the claimant's time-slot dropdown for whichever date
    they picked. ClaimRequests.jsx's own calls omit the param and get
    the full active/future list, exactly as before.
    POST: Staff creates a new available time slot (used by ClaimRequests.jsx).
    """
    if request.method == 'GET':
        # Retrieve only active slots occurring today or in the future
        schedules = AvailableSchedule.objects.filter(
            is_active=True,
            date__gte=datetime.today().date()
        )

        date_param = request.GET.get('date')
        if date_param:
            schedules = schedules.filter(date=date_param)

        schedules = schedules.order_by('date', 'time_slot')
        serializer = AvailableScheduleSerializer(schedules, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    elif request.method == 'POST':
        # Only staff (admin/moderator) can create preset schedule slots.
        if not IsStaffMember().has_permission(request, None):
            return Response(
                {"detail": IsStaffMember.message},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = AvailableScheduleSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated, IsStaffMember])
def delete_schedule(request, pk):
    """
    DELETE: Remove a preset schedule slot (used by ClaimRequests.jsx).
    Staff-only.
    """
    schedule = get_object_or_404(AvailableSchedule, pk=pk)
    schedule.delete()
    return Response({"message": "Schedule slot deleted successfully"}, status=status.HTTP_200_OK)


# -------------------------------------------------------------------
# CLAIM ENDPOINTS
# -------------------------------------------------------------------

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsStaffMember])
def get_claim(request):
    """
    Staff-only: lists every claim, including each item's internal
    `description` (item_details.description) so admin/moderator can compare
    it against the claimant's ownership verification answers.
    """
    claims = Claim.objects.all().order_by('-claim_date')
    serializer = ClaimSerializer(
        claims,
        many=True,
        context={"request": request, "include_item_description": True},
    )
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["POST"])
def create_claim(request):

    claimant_email = request.data.get("claimant_email")
    item_id = request.data.get("item")

    # -------------------------------------------------
    # BLOCK DUPLICATE CLAIMS
    # -------------------------------------------------
    existing_claim = Claim.objects.filter(
        item_id=item_id,
        claimant_email=claimant_email,
        status__in=["Pending", "Scheduled"]
    ).first()

    if existing_claim:
        return Response(
            {
                "detail": "You already submitted a claim request for this item."
            },
            status=status.HTTP_400_BAD_REQUEST
        )

    serializer = ClaimSerializer(data=request.data)

    if serializer.is_valid():
        claim = serializer.save()

        # -------------------------------------------------
        # AUTO-SCHEDULE STATUS FIX
        #
        # If the claimant self-picked a matching meeting date/time at
        # submission time (i.e. their answers verified and they chose a
        # slot in ClaimModal.jsx), mark this claim "Scheduled" right
        # away instead of leaving it "Pending" indefinitely. Previously
        # only staff's manual "Confirm Schedule" action
        # (schedule_meeting view) ever flipped status to "Scheduled",
        # which meant a claimant's own correctly-scheduled claim stayed
        # "Pending" forever unless staff also touched it — permanently
        # blocking that claimant from resubmitting for the same item
        # even after their meeting date passed, since the duplicate
        # guard above matches on status__in=["Pending", "Scheduled"].
        #
        # This only applies when both meeting_date and meeting_time are
        # present on creation. A "pending review" claim (mismatched/
        # unverified answers, submitted with meeting_date/time as null)
        # is unaffected and still starts life as "Pending", to be moved
        # to "Scheduled" later by staff via schedule_meeting once they
        # confirm a slot manually.
        #
        # NOTE: this does NOT set staff_scheduled — a claimant
        # self-picking their own slot is explicitly NOT a staff
        # confirmation (see schedule_meeting below and
        # Dashboard.jsx's isStaffConfirmedSchedule). staff_scheduled
        # stays at its model default (False) here, same as before.
        # -------------------------------------------------
        if claim.meeting_date and claim.meeting_time:
            claim.status = "Scheduled"
            claim.save(update_fields=["status"])

        staff_emails = list(
            User.objects.filter(
                role__in=["admin", "moderator"],
                is_archived=False,
                email__isnull=False,
            )
            .exclude(email="")
            .values_list("email", flat=True)
        )

        if staff_emails:
            try:
                send_mail(
                    "New Claim Request Submitted",
                    f"""
A new claim request has been submitted.

Item: {claim.item.title}
Claimant: {claim.claimant_name}

Preferred Date: {claim.meeting_date}
Preferred Time: {claim.meeting_time}

Proof:
{claim.proof_description}
""",
                    settings.DEFAULT_FROM_EMAIL,
                    staff_emails,
                    fail_silently=False,
                )
            except Exception as e:
                print(e)

        return Response(serializer.data, status=status.HTTP_201_CREATED)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["PUT"])
@permission_classes([IsAuthenticated, IsStaffMember])
def schedule_meeting(request, pk):

    claim = get_object_or_404(Claim, pk=pk)

    meeting_date = request.data.get("meeting_date")
    meeting_time = request.data.get("meeting_time")

    claim.meeting_date = meeting_date
    claim.meeting_time = meeting_time
    claim.meeting_location = "Student Affairs Office"

    # FIX: this view previously only ever read meeting_date/meeting_time
    # off request.data and silently ignored everything else — including
    # staff_scheduled, which ClaimRequests.jsx's send() has always sent
    # as staff_scheduled: true on every call here. Because it was never
    # read, it was never assigned to the claim and never saved, so
    # claim.staff_scheduled stayed at its model default (False) even
    # after a staff member explicitly confirmed a meeting through this
    # exact endpoint.
    #
    # Dashboard.jsx's ClaimScheduleCalendar (isStaffConfirmedSchedule)
    # only lights up a day on the calendar when staff_scheduled is True
    # — so every "Confirm Schedule" action was succeeding (the claim did
    # get its date/time/status set correctly) but never appearing on the
    # dashboard calendar, because the one field that calendar filters on
    # was never persisted.
    #
    # This endpoint is IsStaffMember-gated, so there's no legitimate
    # caller here that isn't staff confirming a meeting — default to
    # True if the key is somehow missing from the payload, rather than
    # silently leaving it False.
    claim.staff_scheduled = bool(request.data.get("staff_scheduled", True))

    # IMPORTANT
    claim.status = "Scheduled"

    claim.save()

    if claim.claimant_email:
        try:
            send_mail(
                "Claim Verification Meeting Scheduled",
                f"""
Hello {claim.claimant_name},

Your verification meeting has been scheduled.

Location: Student Affairs Office
Date: {meeting_date}
Time: {meeting_time}

Please bring your School ID.

- Student Affairs Office
""",
                settings.DEFAULT_FROM_EMAIL,
                [claim.claimant_email],
                fail_silently=False,
            )
        except Exception as e:
            print(e)

    return Response(
        {
            "message": "Meeting scheduled successfully.",
            "claim": ClaimSerializer(
                claim,
                context={
                    "request": request,
                    "include_item_description": True,
                },
            ).data,
        }
    )

@api_view(["GET"])
def check_claim_status(request, item_id):

    email = request.GET.get("email")

    if not email:
        return Response({"claimed": False})

    exists = Claim.objects.filter(
        item_id=item_id,
        claimant_email=email,
        status__in=["Pending", "Scheduled"]
    ).exists()

    return Response({"claimed": exists})

@api_view(["GET"])
def check_item_claim(request, item_id):
    claim = (
        Claim.objects.filter(item_id=item_id)
        .exclude(meeting_date__isnull=True)
        .exclude(meeting_time__isnull=True)
        .first()
    )

    if claim:
        return Response({
            "has_claim": True,
            "meeting_date": claim.meeting_date,
            "meeting_time": claim.meeting_time,
        })

    return Response({"has_claim": False})


# -------------------------------------------------------------------
# ANSWER VERIFICATION (Used by ClaimModal.jsx's live pre-submission check)
# -------------------------------------------------------------------

def _normalize(value):
    return str(value or "").strip().lower()


@api_view(["POST"])
def verify_answers(request, item_id):
    """
    Compares the claimant's submitted answers against this item's
    admin-recorded correct answers and returns ONLY a boolean summary
    ({"all_correct": true|false}) — never the correct answers
    themselves, so nothing here can be used to reverse-engineer them
    from the network tab.

    Mirrors getRecordedAnswer() in ClaimRequests.jsx: checks
    verification_answer_N first, then correct_answer_N as a fallback.
    Comparison is case-insensitive / whitespace-trimmed, matching the
    normalize() used there for staff-side comparison.

    A question with no recorded correct answer on the item (neither
    field set, or the question slot itself isn't configured) is
    treated as automatically satisfied — there's nothing to check it
    against, so it can't fail the claimant.

    NOTE: field names verification_answer_N / correct_answer_N are
    assumed to match ItemDetails as guessed in ClaimRequests.jsx.
    Confirm against the actual model before relying on this in
    production.
    """
    item = get_object_or_404(ItemDetails, pk=item_id)

    all_correct = True

    for n in range(1, 5):
        question = getattr(item, f"verification_question_{n}", None)
        if not question or not str(question).strip():
            continue  # this question slot isn't configured on the item

        recorded = (
            getattr(item, f"verification_answer_{n}", None)
            or getattr(item, f"correct_answer_{n}", None)
        )

        if recorded is None or str(recorded).strip() == "":
            continue  # nothing recorded to check this one against

        submitted = request.data.get(f"answer_{n}", "")

        if _normalize(recorded) != _normalize(submitted):
            all_correct = False
            break

    return Response({"all_correct": all_correct}, status=status.HTTP_200_OK)