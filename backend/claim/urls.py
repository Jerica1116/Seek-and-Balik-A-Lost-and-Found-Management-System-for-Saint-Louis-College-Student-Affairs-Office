from django.urls import path
from .views import (
    get_claim,
    create_claim,
    schedule_meeting,
    available_schedules,
    delete_schedule,
    check_claim_status,
    check_item_claim,
    verify_answers,
)

urlpatterns = [
    path('', get_claim, name='get_claims'),
    path('create/', create_claim, name='create_claim'),
    path('schedule/<int:pk>/', schedule_meeting, name='schedule_meeting'),
    path('schedules/', available_schedules, name='available_schedules'),
    path('schedules/<int:pk>/', delete_schedule, name='delete_schedule'),
    path('check/<int:item_id>/', check_claim_status, name='check_claim_status'),
    path('check-item/<int:item_id>/', check_item_claim, name='check_item_claim'),
    path('verify-answers/<int:item_id>/', verify_answers, name='verify_answers'),
]