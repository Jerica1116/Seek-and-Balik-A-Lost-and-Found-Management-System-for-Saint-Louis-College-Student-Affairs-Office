from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.db.models import F
from datetime import date
from .models import LeaderboardSettings

from .models import LeaderboardPlayer, PointTransaction
from .serializers import LeaderboardPlayerSerializer, PointTransactionSerializer


def get_current_leaderboard_settings():
    settings, _ = LeaderboardSettings.objects.get_or_create(id=1)

    today = date.today()

    if settings.auto_mode and settings.open_date and settings.close_date:
        settings.is_active = settings.open_date <= today <= settings.close_date
        settings.save(update_fields=["is_active", "updated_at"])

    return settings


@api_view(["GET"])
def leaderboard(request):
    settings = get_current_leaderboard_settings()

    if not settings.is_active:
        return Response({
            "active": False,
            "leaders": [],
        })

    players = LeaderboardPlayer.objects.order_by("-points", "full_name")[:20]
    serializer = LeaderboardPlayerSerializer(players, many=True)

    return Response({
        "active": True,
        "leaders": serializer.data,
    })


@api_view(["GET", "POST"])
def points_tracking(request):
    if request.method == "POST":
        data = request.data
        id_number = data.get("id_number")
        player_name = data.get("player_name", "")
        reason = data.get("reason")
        item_id_raw = data.get("item_id")
        points = data.get("points", 0)

        if not id_number or not reason:
            return Response({"detail": "id_number and reason are required."}, status=400)

        # item_id is a ticket code (e.g. "FND-2026-014"), not a numeric id.
        # Previously this was forced through int(...), which raised
        # ValueError on any non-numeric code and was silently caught down
        # to None — collapsing every SURRENDER_ITEM transaction for the
        # same student onto the same (player, reason, item_id=None) tuple,
        # which then collided with the unique_together constraint below.
        # Keeping it as a plain string preserves each item's own identity.
        item_id = str(item_id_raw).strip() if item_id_raw not in (None, "") else None

        player, created = LeaderboardPlayer.objects.get_or_create(
            student_id=id_number,
            defaults={"full_name": player_name, "points": 0},
        )
        if not created and player_name and player.full_name != player_name:
            player.full_name = player_name
            player.save(update_fields=["full_name"])

        transaction, tx_created = PointTransaction.objects.get_or_create(
            player=player,
            reason=reason,
            item_id=item_id,
            defaults={"points": points},
        )

        if tx_created:
            LeaderboardPlayer.objects.filter(pk=player.pk).update(points=F("points") + points)
            player.refresh_from_db()
        else:
            # Same player/reason/item combo already exists — don't double-award.
            serializer = PointTransactionSerializer(transaction)
            return Response(serializer.data, status=200)

        serializer = PointTransactionSerializer(transaction)
        return Response(serializer.data, status=201)

    transactions = PointTransaction.objects.select_related("player").order_by("-created_at")
    serializer = PointTransactionSerializer(transactions, many=True)
    return Response(serializer.data)


@api_view(["GET"])
def leaderboard_settings(request):
    settings = get_current_leaderboard_settings()

    return Response({
        "is_active": settings.is_active,
        "auto_mode": settings.auto_mode,
        "open_date": settings.open_date,
        "close_date": settings.close_date,
    })


@api_view(["PUT"])
def update_leaderboard_settings(request):
    settings, _ = LeaderboardSettings.objects.get_or_create(id=1)

    settings.auto_mode = request.data.get("auto_mode", settings.auto_mode)
    settings.open_date = request.data.get("open_date") or None
    settings.close_date = request.data.get("close_date") or None

    if not settings.auto_mode:
        settings.is_active = request.data.get("is_active", settings.is_active)

    settings.save()

    return Response({"message": "Leaderboard settings updated"})