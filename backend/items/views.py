import json
import logging
import random
from gamification.services import award_points, get_item_points, CLAIMED_BONUS_POINTS
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import ItemDetails, ItemImage
from .serializers import ItemSerializers
from notification.service import send_new_report_notification

logger = logging.getLogger(__name__)

MAX_IMAGES_PER_ITEM = 3


# GET ALL ITEMS
@api_view(['GET'])
def get_item_details(request):
    items = ItemDetails.objects.all()
    serializer = ItemSerializers(items, many=True, context={'request': request})
    return Response(serializer.data)


# CREATE ITEM (WITH EMAIL + TICKET SYSTEM)
@api_view(['POST'])
def create_item_details(request):
    serializer = ItemSerializers(data=request.data, context={'request': request})

    if serializer.is_valid():
        item = serializer.save()

        # The frontend sends every uploaded photo (up to 3) as repeated
        # 'image' entries in the multipart form. The ModelSerializer's
        # 'image' field above only keeps the last one, so grab the full
        # list here and store each file as its own ItemImage row.
        #
        # FIX: cap at MAX_IMAGES_PER_ITEM server-side too — the frontend
        # already limits this to 3, but nothing previously stopped a
        # direct API call (or a future frontend bug) from creating
        # unlimited ItemImage rows for one item.
        images_list = request.FILES.getlist('image')[:MAX_IMAGES_PER_ITEM]
        for img_file in images_list:
            ItemImage.objects.create(item=item, image=img_file)

        if (
            item.type == "Surrendered"
            and item.status == "Approved"
            and not item.surrender_points_awarded
        ):
            award_points(
                student_id=item.student_id,
                full_name=item.poster_name,
                points=get_item_points(item),
                reason="SURRENDER_ITEM",
                item_id=item.id,
            )

            item.surrender_points_awarded = True
            item.save(update_fields=["surrender_points_awarded"])

        if item.email:
            try:
                send_new_report_notification(item)
            except Exception:
                # Log the full error (e.g. SMTPAuthenticationError) instead of
                # swallowing it silently, so failures show up in the server logs.
                logger.exception(
                    "Failed to send lost item report email to %s (ticket %s)",
                    item.email, item.ticket_code,
                )

        return Response({
            "message": "Item created successfully",
            "ticket_code": item.ticket_code,
            "data": ItemSerializers(item, context={'request': request}).data
        }, status=status.HTTP_201_CREATED)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# GET SINGLE ITEM + UPDATE + DELETE
@api_view(['GET', 'PUT', 'DELETE'])
def item_details(request, pk):
    try:
        item = ItemDetails.objects.get(pk=pk)
    except ItemDetails.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        serializer = ItemSerializers(item, context={'request': request})
        return Response(serializer.data)

    elif request.method == 'PUT':
        serializer = ItemSerializers(item, data=request.data, partial=True, context={'request': request})

        if serializer.is_valid():
            updated_item = serializer.save()

            # ------------------------------------------------------------
            # PHOTO HANDLING ON EDIT
            #
            # BUG FIX: the previous version did
            #     if images_list: item.images.all().delete()
            # which wiped EVERY existing photo the moment even one new
            # photo was uploaded — so a user who kept 2 old photos and
            # added 1 new one would lose the 2 they meant to keep, since
            # the frontend only sends already-saved photos as their
            # existing IDs (via `keep_image_ids`), never re-uploads them
            # as files.
            #
            # New contract with the frontend:
            #   - `keep_image_ids` (optional): JSON array of ItemImage
            #     ids the client wants to KEEP. Any existing image for
            #     this item whose id is NOT in that list gets deleted.
            #     If this field is omitted entirely, nothing existing is
            #     deleted (safe default for older/other callers).
            #   - `image` (optional, repeatable): new files to add,
            #     filling whatever slots remain up to MAX_IMAGES_PER_ITEM
            #     after the keep/delete step above.
            # ------------------------------------------------------------
            keep_ids_raw = request.data.get('keep_image_ids')
            if keep_ids_raw is not None:
                try:
                    keep_ids = {int(i) for i in json.loads(keep_ids_raw)}
                except (TypeError, ValueError):
                    # Malformed input — don't guess, don't delete anything.
                    keep_ids = set(item.images.values_list('id', flat=True))

                item.images.exclude(id__in=keep_ids).delete()

            remaining_slots = max(0, MAX_IMAGES_PER_ITEM - item.images.count())
            images_list = request.FILES.getlist('image')[:remaining_slots]
            for img_file in images_list:
                ItemImage.objects.create(item=updated_item, image=img_file)

            if (
                updated_item.type == "Surrendered"
                and updated_item.status in ["Claimed", "Returned"]
                and not updated_item.claimed_bonus_awarded
            ):
                award_points(
                    student_id=updated_item.student_id,
                    full_name=updated_item.poster_name,
                    points=CLAIMED_BONUS_POINTS,
                    reason="ITEM_CLAIMED",
                    item_id=updated_item.id,
                )

                updated_item.claimed_bonus_awarded = True
                updated_item.save(update_fields=["claimed_bonus_awarded"])

            return Response(
                ItemSerializers(updated_item, context={'request': request}).data,
                status=status.HTTP_200_OK
            )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    elif request.method == 'DELETE':
        item.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# VERIFY OWNERSHIP ANSWERS (used by the public Claim Modal)
@api_view(['POST'])
def verify_answers(request, pk):
    """
    Grades a claimant's selected multiple-choice answers against the real
    verification_answer_N values server-side. The correct answer text is
    NEVER returned — only per-question true/false plus an overall flag —
    so the Claim Modal can gate the Verification Schedule section on
    correctness without ever seeing which option was right.

    Only questions that actually have a real answer set on this item are
    graded here. Any index the claimant didn't include, or that this item
    has no answer for, is simply left out of `results`.

    Body: {"answers": {"1": "chosen text", "2": "chosen text", ...}}
    """
    try:
        item = ItemDetails.objects.get(pk=pk)
    except ItemDetails.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)

    submitted = request.data.get("answers", {}) or {}
    if not isinstance(submitted, dict):
        return Response(
            {"detail": "answers must be an object keyed by question number."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    results = {}
    for n in range(1, 5):
        real_answer = (getattr(item, f'verification_answer_{n}') or '').strip()
        if not real_answer:
            # Nothing to grade for this question (no admin-defined answer).
            continue

        key = str(n)
        if key not in submitted:
            continue

        chosen = str(submitted.get(key) or '').strip()
        results[key] = chosen.lower() == real_answer.lower()

    all_correct = bool(results) and all(results.values())

    return Response(
        {"results": results, "all_correct": all_correct},
        status=status.HTTP_200_OK,
    )


@api_view(['GET'])
def track_item(request, ticket_code):
    try:
        item = ItemDetails.objects.get(ticket_code=ticket_code)

        serializer = ItemSerializers(item, context={'request': request})

        return Response({
            "found": True,
            "item": serializer.data
        })

    except ItemDetails.DoesNotExist:
        return Response({
            "found": False,
            "message": "Ticket not found"
        }, status=status.HTTP_404_NOT_FOUND)