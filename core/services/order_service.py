import hashlib
import json
from datetime import datetime
from decimal import Decimal
from zoneinfo import ZoneInfo
from django.db import transaction
from django.utils import timezone
from core.models import Product, Dealer, Order, OrderItem, IdempotencyRecord, DailyOrderSequence
from core.services.gst_calculator import calculate_line_item, calculate_order_totals, format_money

KOLKATA_TZ = ZoneInfo("Asia/Kolkata")


class OrderServiceException(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400, details: list = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or []


def generate_order_number() -> str:
    """
    Generates a unique order number in format ORD-YYYYMMDD-NNNN in Asia/Kolkata timezone.
    Uses pessimistic database row locking to guarantee gapless uniqueness under concurrent requests.
    """
    now_ist = datetime.now(KOLKATA_TZ)
    date_key = now_ist.date()

    seq_obj, _ = DailyOrderSequence.objects.select_for_update().get_or_create(
        date=date_key,
        defaults={"last_number": 0},
    )
    seq_obj.last_number += 1
    seq_obj.save(update_fields=["last_number"])

    return f"ORD-{date_key.strftime('%Y%m%d')}-{seq_obj.last_number:04d}"


def create_draft_order(dealer_id: int, items_data: list[dict], raw_body: bytes = None, idempotency_key: str = None) -> tuple[Order, bool]:
    """
    Creates a new DRAFT order with input validation, stock decoupling, and optional idempotency.
    Returns (order, was_created).
    """
    if idempotency_key:
        body_hash = hashlib.sha256(raw_body or b"").hexdigest()
        existing = IdempotencyRecord.objects.filter(key=idempotency_key).first()
        if existing:
            if existing.request_hash == body_hash:
                order = Order.objects.get(order_number=existing.response_data["order_number"])
                return order, False
            else:
                raise OrderServiceException(
                    code="IDEMPOTENCY_CONFLICT",
                    message="Idempotency key reused with a different request payload.",
                    status_code=409,
                )

    if not dealer_id:
        raise OrderServiceException(code="VALIDATION_ERROR", message="dealer_id is required.", status_code=400)

    dealer = Dealer.objects.filter(id=dealer_id).first()
    if not dealer:
        raise OrderServiceException(code="VALIDATION_ERROR", message=f"Dealer with id {dealer_id} does not exist.", status_code=400)

    if not items_data or not isinstance(items_data, list):
        raise OrderServiceException(code="VALIDATION_ERROR", message="Order must contain at least one item.", status_code=400)

    # Validate items
    seen_skus = set()
    sku_quantities = []
    for idx, item in enumerate(items_data):
        sku = item.get("sku")
        if not sku or not isinstance(sku, str):
            raise OrderServiceException(code="VALIDATION_ERROR", message=f"Item {idx}: valid sku is required.", status_code=400)
        sku = sku.strip()
        if sku in seen_skus:
            raise OrderServiceException(code="VALIDATION_ERROR", message=f"Duplicate SKU '{sku}' in order items.", status_code=400)
        seen_skus.add(sku)

        qty = item.get("quantity")
        if qty is None or not isinstance(qty, int) or qty < 1:
            raise OrderServiceException(code="VALIDATION_ERROR", message=f"Item '{sku}': quantity must be an integer >= 1.", status_code=400)

        sku_quantities.append((sku, qty))

    # Fetch products
    products_by_sku = {p.sku: p for p in Product.objects.filter(sku__in=seen_skus)}
    for sku, _ in sku_quantities:
        if sku not in products_by_sku:
            raise OrderServiceException(code="VALIDATION_ERROR", message=f"Product with SKU '{sku}' does not exist.", status_code=400)

    with transaction.atomic():
        order_number = generate_order_number()
        order = Order.objects.create(
            order_number=order_number,
            dealer=dealer,
            status=Order.STATUS_DRAFT,
            subtotal=Decimal("0.00"),
            tax_total=Decimal("0.00"),
            grand_total=Decimal("0.00"),
        )

        calculated_lines = []
        for sku, qty in sku_quantities:
            product = products_by_sku[sku]
            unit_price = product.price
            calc = calculate_line_item(unit_price, qty)
            calculated_lines.append(calc)

            OrderItem.objects.create(
                order=order,
                product=product,
                sku=sku,
                name=product.name,
                quantity=qty,
                unit_price=calc["unit_price"],
                line_subtotal=calc["line_subtotal"],
                line_tax=calc["line_tax"],
                line_total=calc["line_total"],
            )

        totals = calculate_order_totals(calculated_lines)
        order.subtotal = totals["subtotal"]
        order.tax_total = totals["tax_total"]
        order.grand_total = totals["grand_total"]
        order.save(update_fields=["subtotal", "tax_total", "grand_total"])

        return order, True


def update_draft_order_items(order_number: str, items_data: list[dict]) -> Order:
    """
    Replaces all items in a DRAFT order. If order is not in DRAFT status, raises ORDER_LOCKED (409).
    """
    order = Order.objects.filter(order_number=order_number).first()
    if not order:
        raise OrderServiceException(code="NOT_FOUND", message=f"Order '{order_number}' not found.", status_code=404)

    if order.status != Order.STATUS_DRAFT:
        raise OrderServiceException(code="ORDER_LOCKED", message="Cannot edit order that is not in DRAFT status.", status_code=409)

    if not items_data or not isinstance(items_data, list):
        raise OrderServiceException(code="VALIDATION_ERROR", message="Order must contain at least one item.", status_code=400)

    seen_skus = set()
    sku_quantities = []
    for idx, item in enumerate(items_data):
        sku = item.get("sku")
        if not sku or not isinstance(sku, str):
            raise OrderServiceException(code="VALIDATION_ERROR", message=f"Item {idx}: valid sku is required.", status_code=400)
        sku = sku.strip()
        if sku in seen_skus:
            raise OrderServiceException(code="VALIDATION_ERROR", message=f"Duplicate SKU '{sku}' in order items.", status_code=400)
        seen_skus.add(sku)

        qty = item.get("quantity")
        if qty is None or not isinstance(qty, int) or qty < 1:
            raise OrderServiceException(code="VALIDATION_ERROR", message=f"Item '{sku}': quantity must be an integer >= 1.", status_code=400)

        sku_quantities.append((sku, qty))

    products_by_sku = {p.sku: p for p in Product.objects.filter(sku__in=seen_skus)}
    for sku, _ in sku_quantities:
        if sku not in products_by_sku:
            raise OrderServiceException(code="VALIDATION_ERROR", message=f"Product with SKU '{sku}' does not exist.", status_code=400)

    with transaction.atomic():
        order.items.all().delete()

        calculated_lines = []
        for sku, qty in sku_quantities:
            product = products_by_sku[sku]
            calc = calculate_line_item(product.price, qty)
            calculated_lines.append(calc)

            OrderItem.objects.create(
                order=order,
                product=product,
                sku=sku,
                name=product.name,
                quantity=qty,
                unit_price=calc["unit_price"],
                line_subtotal=calc["line_subtotal"],
                line_tax=calc["line_tax"],
                line_total=calc["line_total"],
            )

        totals = calculate_order_totals(calculated_lines)
        order.subtotal = totals["subtotal"]
        order.tax_total = totals["tax_total"]
        order.grand_total = totals["grand_total"]
        order.save(update_fields=["subtotal", "tax_total", "grand_total", "updated_at"])

        return order


def confirm_order(order_number: str) -> Order:
    """
    Confirms a DRAFT order:
    - Atomically verifies stock across all lines (all-or-nothing).
    - If any line is short, raises INSUFFICIENT_STOCK (409) with details.
    - Deducts stock using SELECT FOR UPDATE with sorted SKU locking to prevent deadlocks.
    - Locks unit price.
    - Transitions status to CONFIRMED.
    """
    with transaction.atomic():
        order = Order.objects.select_for_update().filter(order_number=order_number).first()
        if not order:
            raise OrderServiceException(code="NOT_FOUND", message=f"Order '{order_number}' not found.", status_code=404)

        if order.status != Order.STATUS_DRAFT:
            raise OrderServiceException(code="INVALID_TRANSITION", message=f"Cannot confirm order in status '{order.status}'.", status_code=409)

        items = list(order.items.all())
        skus = sorted([item.sku for item in items])

        # Lock products in deterministic alphabetical order
        products = {p.sku: p for p in Product.objects.select_for_update().filter(sku__in=skus)}

        short_lines = []
        error_sentences = []
        for item in items:
            prod = products.get(item.sku)
            available = prod.stock if prod else 0
            if available < item.quantity:
                short_lines.append({"sku": item.sku, "requested": item.quantity, "available": available})
                prod_name = prod.name if prod else item.name
                error_sentences.append(f"Insufficient stock for {prod_name}. Available: {available}, Requested: {item.quantity}")

        if short_lines:
            raise OrderServiceException(
                code="INSUFFICIENT_STOCK",
                message=" ".join(error_sentences),
                status_code=409,
                details=short_lines,
            )

        # Deduct stock and lock prices
        for item in items:
            prod = products[item.sku]
            prod.stock -= item.quantity
            prod.save(update_fields=["stock", "updated_at"])

            # Lock unit price to current product price
            calc = calculate_line_item(prod.price, item.quantity)
            item.unit_price = calc["unit_price"]
            item.line_subtotal = calc["line_subtotal"]
            item.line_tax = calc["line_tax"]
            item.line_total = calc["line_total"]
            item.save(update_fields=["unit_price", "line_subtotal", "line_tax", "line_total"])

        order.status = Order.STATUS_CONFIRMED
        order.save(update_fields=["status", "updated_at"])
        return order


def cancel_order(order_number: str) -> Order:
    """
    Cancels an order:
    - If DRAFT: transitions to CANCELLED without touching stock.
    - If CONFIRMED: restores stock exactly once using SELECT FOR UPDATE, then transitions to CANCELLED.
    - If DISPATCHED, DELIVERED, or CANCELLED: raises INVALID_TRANSITION (409).
    """
    with transaction.atomic():
        order = Order.objects.select_for_update().filter(order_number=order_number).first()
        if not order:
            raise OrderServiceException(code="NOT_FOUND", message=f"Order '{order_number}' not found.", status_code=404)

        if order.status not in (Order.STATUS_DRAFT, Order.STATUS_CONFIRMED):
            raise OrderServiceException(code="INVALID_TRANSITION", message=f"Cannot cancel order in status '{order.status}'.", status_code=409)

        if order.status == Order.STATUS_CONFIRMED:
            items = list(order.items.all())
            skus = sorted([item.sku for item in items])
            products = {p.sku: p for p in Product.objects.select_for_update().filter(sku__in=skus)}

            for item in items:
                prod = products.get(item.sku)
                if prod:
                    prod.stock += item.quantity
                    prod.save(update_fields=["stock", "updated_at"])

        order.status = Order.STATUS_CANCELLED
        order.save(update_fields=["status", "updated_at"])
        return order


def dispatch_order(order_number: str) -> Order:
    with transaction.atomic():
        order = Order.objects.select_for_update().filter(order_number=order_number).first()
        if not order:
            raise OrderServiceException(code="NOT_FOUND", message=f"Order '{order_number}' not found.", status_code=404)
        if order.status != Order.STATUS_CONFIRMED:
            raise OrderServiceException(code="INVALID_TRANSITION", message=f"Cannot dispatch order in status '{order.status}'.", status_code=409)
        order.status = Order.STATUS_DISPATCHED
        order.save(update_fields=["status", "updated_at"])
        return order


def deliver_order(order_number: str) -> Order:
    with transaction.atomic():
        order = Order.objects.select_for_update().filter(order_number=order_number).first()
        if not order:
            raise OrderServiceException(code="NOT_FOUND", message=f"Order '{order_number}' not found.", status_code=404)
        if order.status != Order.STATUS_DISPATCHED:
            raise OrderServiceException(code="INVALID_TRANSITION", message=f"Cannot deliver order in status '{order.status}'.", status_code=409)
        order.status = Order.STATUS_DELIVERED
        order.save(update_fields=["status", "updated_at"])
        return order
