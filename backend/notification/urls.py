from django.urls import path
from .views import report_item_public

urlpatterns = [
    path('report-lost/', report_item_public, name='report_item_public'),
]