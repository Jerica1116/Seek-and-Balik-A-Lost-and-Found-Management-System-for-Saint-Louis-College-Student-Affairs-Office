from django.urls import path
from django.conf import settings
from django.conf.urls.static import static

# Grouped imports for cleaner code
from .views import (
    login, 
    logout, 
    register, 
    refresh_token, 
    current_user, 
    get_user, 
    update_user, 
    change_password
)

urlpatterns = [
    # =====================
    # AUTHENTICATION
    # =====================
    path('login/', login, name='login'),
    path('logout/', logout, name='logout'),
    path('refresh/', refresh_token, name='refresh_token'),
    path('change-password/', change_password, name='change_password'),
    
    # =====================
    # ACTIVE SESSION
    # =====================
    path('current/', current_user, name='current_user'),
    
    # =====================
    # USER MANAGEMENT
    # =====================
    path('register/', register, name='register'),
    path('users/', get_user, name='get_user'),                 # Expected to handle GET (list all) and POST (create)
    path('users/<int:pk>/', update_user, name='update_user'),  # Expected to handle GET (single), PUT/PATCH (update)
]

# Only serve media files through Django during development
# In production, your web server (like Nginx or Apache) should handle this.
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)