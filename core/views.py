import json
from decimal import Decimal
from django.db.models import Q
from django.http import JsonResponse
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from core.models import Product, Dealer, Order, OrderItem, InventoryLog
from core.pagination import StandardPagination
from core.serializers import (
    ProductSerializer,
    ProductCreateSerializer,
    DealerSerializer,
    DealerCreateSerializer,
    OrderSerializer,
)
from core.exceptions import error_response
from core.services.order_service import (
    OrderServiceException,
    create_draft_order,
    update_draft_order_items,
    confirm_order,
    cancel_order,
    dispatch_order,
    deliver_order,
)


@api_view(["GET"])
def health(request):
    """GET /api/health/ — the grader polls this until your app is ready."""
    return JsonResponse({"status": "ok"})


# --------------------------------------------------------------------------------------
# Products (§4)
# --------------------------------------------------------------------------------------
@api_view(["GET", "POST"])
def products_list_create(request):
    if request.method == "GET":
        qs = Product.objects.all().order_by("sku")

        # Filters
        search = request.query_params.get("search")
        if search:
            qs = qs.filter(Q(sku__icontains=search) | Q(name__icontains=search) | Q(brand__icontains=search))

        category = request.query_params.get("category")
        if category:
            qs = qs.filter(category=category)

        vehicle = request.query_params.get("vehicle")
        if vehicle:
            qs = qs.filter(vehicle_fitment__icontains=vehicle)

        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = ProductSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    elif request.method == "POST":
        sku = request.data.get("sku")
        if not sku or not isinstance(sku, str):
            return error_response("VALIDATION_ERROR", "sku is required.", 400)
        sku = sku.strip()

        if Product.objects.filter(sku=sku).exists():
            return error_response("DUPLICATE", f"Product with SKU '{sku}' already exists.", 409)

        serializer = ProductCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "VALIDATION_ERROR",
                "; ".join([f"{k}: {' '.join(v)}" for k, v in serializer.errors.items()]),
                400,
                [{"field": k, "error": v} for k, v in serializer.errors.items()],
            )

        product = serializer.save(stock=0)
        return Response(ProductSerializer(product).data, status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH"])
def product_detail(request, sku):
    product = Product.objects.filter(sku=sku).first()
    if not product:
        return error_response("NOT_FOUND", f"Product with SKU '{sku}' does not exist.", 404)

    if request.method == "GET":
        return Response(ProductSerializer(product).data)

    elif request.method == "PATCH":
        if "sku" in request.data and request.data["sku"] != product.sku:
            return error_response("VALIDATION_ERROR", "SKU cannot be changed.", 400)

        price = request.data.get("price")
        if price is not None:
            try:
                dec_price = Decimal(str(price))
                if dec_price <= Decimal("0.00") or dec_price.as_tuple().exponent < -2:
                    return error_response("VALIDATION_ERROR", "Price must be > 0 with at most 2 decimals.", 400)
            except Exception:
                return error_response("VALIDATION_ERROR", "Invalid price format.", 400)

        for field in ("name", "category", "brand", "vehicle_fitment", "description", "price"):
            if field in request.data:
                setattr(product, field, request.data[field])

        product.save()
        return Response(ProductSerializer(product).data)


# --------------------------------------------------------------------------------------
# Inventory (§5)
# --------------------------------------------------------------------------------------
@api_view(["PUT"])
def inventory_update(request, sku):
    product = Product.objects.filter(sku=sku).first()
    if not product:
        return error_response("NOT_FOUND", f"Product with SKU '{sku}' does not exist.", 404)

    qty = request.data.get("quantity")
    if qty is None or not isinstance(qty, int) or qty < 0:
        return error_response("VALIDATION_ERROR", "quantity must be an integer >= 0.", 400)

    reason = request.data.get("reason", "")
    product.stock = qty
    product.save(update_fields=["stock", "updated_at"])

    InventoryLog.objects.create(product=product, quantity=qty, reason=reason)

    return Response({"sku": product.sku, "quantity": product.stock})


# --------------------------------------------------------------------------------------
# Dealers (§6)
# --------------------------------------------------------------------------------------
@api_view(["GET", "POST"])
def dealers_list_create(request):
    if request.method == "GET":
        qs = Dealer.objects.all().order_by("id")
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = DealerSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    elif request.method == "POST":
        dealer_code = request.data.get("dealer_code")
        if not dealer_code or not isinstance(dealer_code, str):
            return error_response("VALIDATION_ERROR", "dealer_code is required.", 400)
        dealer_code = dealer_code.strip()

        if Dealer.objects.filter(dealer_code=dealer_code).exists():
            return error_response("DUPLICATE", f"Dealer with code '{dealer_code}' already exists.", 409)

        name = request.data.get("name")
        if not name or not isinstance(name, str):
            return error_response("VALIDATION_ERROR", "name is required.", 400)

        serializer = DealerCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "VALIDATION_ERROR",
                "; ".join([f"{k}: {' '.join(v)}" for k, v in serializer.errors.items()]),
                400,
            )

        dealer = serializer.save()
        return Response(DealerSerializer(dealer).data, status=status.HTTP_201_CREATED)


@api_view(["GET"])
def dealer_detail(request, pk):
    dealer = Dealer.objects.filter(id=pk).first()
    if not dealer:
        return error_response("NOT_FOUND", f"Dealer with id {pk} does not exist.", 404)
    return Response(DealerSerializer(dealer).data)


# --------------------------------------------------------------------------------------
# Orders (§7)
# --------------------------------------------------------------------------------------
@api_view(["GET", "POST"])
def orders_list_create(request):
    if request.method == "GET":
        qs = Order.objects.all().order_by("-created_at")

        dealer_id = request.query_params.get("dealer_id")
        if dealer_id:
            qs = qs.filter(dealer_id=dealer_id)

        status_filter = request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)

        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = OrderSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    elif request.method == "POST":
        dealer_id = request.data.get("dealer_id")
        items = request.data.get("items")
        idempotency_key = request.headers.get("Idempotency-Key")

        try:
            order, created = create_draft_order(
                dealer_id=dealer_id,
                items_data=items,
                raw_body=request.body,
                idempotency_key=idempotency_key,
            )
            serializer = OrderSerializer(order)
            return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)
        except OrderServiceException as e:
            return error_response(e.code, e.message, e.status_code, e.details)


@api_view(["GET", "PUT"])
def order_detail_update(request, order_number):
    order = Order.objects.filter(order_number=order_number).first()
    if not order:
        return error_response("NOT_FOUND", f"Order '{order_number}' not found.", 404)

    if request.method == "GET":
        return Response(OrderSerializer(order).data)

    elif request.method == "PUT":
        items = request.data.get("items")
        try:
            updated_order = update_draft_order_items(order_number=order_number, items_data=items)
            return Response(OrderSerializer(updated_order).data)
        except OrderServiceException as e:
            return error_response(e.code, e.message, e.status_code, e.details)


@api_view(["POST"])
def order_confirm(request, order_number):
    try:
        confirmed = confirm_order(order_number)
        return Response(OrderSerializer(confirmed).data)
    except OrderServiceException as e:
        return error_response(e.code, e.message, e.status_code, e.details)


@api_view(["POST"])
def order_cancel(request, order_number):
    try:
        cancelled = cancel_order(order_number)
        return Response(OrderSerializer(cancelled).data)
    except OrderServiceException as e:
        return error_response(e.code, e.message, e.status_code, e.details)


@api_view(["POST"])
def order_dispatch(request, order_number):
    try:
        dispatched = dispatch_order(order_number)
        return Response(OrderSerializer(dispatched).data)
    except OrderServiceException as e:
        return error_response(e.code, e.message, e.status_code, e.details)


@api_view(["POST"])
def order_deliver(request, order_number):
    try:
        delivered = deliver_order(order_number)
        return Response(OrderSerializer(delivered).data)
    except OrderServiceException as e:
        return error_response(e.code, e.message, e.status_code, e.details)


# --------------------------------------------------------------------------------------
# Supplier Sync (§8)
# --------------------------------------------------------------------------------------
from core.services.sync_service import run_supplier_sync, SupplierSyncException


@api_view(["POST"])
def supplier_sync(request):
    try:
        result = run_supplier_sync()
        return Response(result, status=status.HTTP_200_OK)
    except SupplierSyncException as e:
        return error_response(e.code, e.message, e.status_code)
    except Exception as e:
        return error_response("SUPPLIER_UNAVAILABLE", str(e), 502)


# --------------------------------------------------------------------------------------
# Dealer Assistant (§9)
# --------------------------------------------------------------------------------------
from core.services.assistant_service import run_assistant_turn


@api_view(["POST"])
def assistant_chat(request):
    session_id = request.data.get("session_id")
    dealer_id = request.data.get("dealer_id")
    message = request.data.get("message")

    if not session_id or not isinstance(session_id, str):
        return error_response("VALIDATION_ERROR", "session_id is required.", 400)
    if not message or not isinstance(message, str):
        return error_response("VALIDATION_ERROR", "message is required.", 400)

    try:
        dealer_int = int(dealer_id) if dealer_id is not None else 1
    except (ValueError, TypeError):
        dealer_int = 1

    result = run_assistant_turn(session_id=session_id.strip(), dealer_id=dealer_int, user_message=message.strip())
    return Response(result, status=status.HTTP_200_OK)


# --------------------------------------------------------------------------------------
# Forecasting & Reorder (§10)
# --------------------------------------------------------------------------------------
from core.services.reorder_service import load_forecast_data, get_reorder_suggestions


@api_view(["GET"])
def forecast_detail(request, sku):
    forecast_data = load_forecast_data()
    sku_clean = sku.strip()
    if sku_clean not in forecast_data:
        return error_response("NOT_FOUND", f"Forecast for SKU '{sku_clean}' not found.", 404)
    return Response({"sku": sku_clean, "forecast": forecast_data[sku_clean]}, status=status.HTTP_200_OK)


@api_view(["GET"])
def reorder_suggestions_view(request):
    results = get_reorder_suggestions()
    return Response({"results": results}, status=status.HTTP_200_OK)
