from django.urls import path
from core import views

urlpatterns = [
    # Health check
    path("health/", views.health, name="health"),

    # Products (§4)
    path("products/", views.products_list_create, name="products_list_create"),
    path("products/<str:sku>/", views.product_detail, name="product_detail"),

    # Inventory (§5)
    path("inventory/<str:sku>/", views.inventory_update, name="inventory_update"),

    # Dealers (§6)
    path("dealers/", views.dealers_list_create, name="dealers_list_create"),
    path("dealers/<int:pk>/", views.dealer_detail, name="dealer_detail"),

    # Orders (§7)
    path("orders/", views.orders_list_create, name="orders_list_create"),
    path("orders/<str:order_number>/", views.order_detail_update, name="order_detail_update"),
    path("orders/<str:order_number>/confirm/", views.order_confirm, name="order_confirm"),
    path("orders/<str:order_number>/cancel/", views.order_cancel, name="order_cancel"),
    path("orders/<str:order_number>/dispatch/", views.order_dispatch, name="order_dispatch"),
    path("orders/<str:order_number>/deliver/", views.order_deliver, name="order_deliver"),

    # Supplier Sync (§8)
    path("sync/supplier/", views.supplier_sync, name="supplier_sync"),

    # Dealer Assistant (§9)
    path("assistant/chat/", views.assistant_chat, name="assistant_chat"),

    # Forecasting & Reorder (§10)
    path("forecast/<str:sku>/", views.forecast_detail, name="forecast_detail"),
    path("reorder-suggestions/", views.reorder_suggestions_view, name="reorder_suggestions"),
]
