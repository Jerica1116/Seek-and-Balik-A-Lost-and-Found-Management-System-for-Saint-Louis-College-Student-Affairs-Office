from django.contrib import admin
# pyrefly: ignore [missing-import]
from .models import ItemDetails, ItemImage


class ItemImageInline(admin.TabularInline):
    model = ItemImage
    extra = 0


# Register your models here.
class ItemAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'type', 'location', 'category', 'status', 'created_date', 'created_time', 'image')
    inlines = [ItemImageInline]

admin.site.register(ItemDetails, ItemAdmin)