from decimal import Decimal
from django.db import models
from django.utils import timezone


class Product(models.Model):
    sku = models.CharField(max_length=64, unique=True, db_index=True)
    name = models.CharField(max_length=255)
    category = models.CharField(max_length=100, db_index=True)
    brand = models.CharField(max_length=100, db_index=True)
    vehicle_fitment = models.CharField(max_length=255, db_index=True)
    price = models.DecimalField(max_digits=12, decimal_places=2)
    stock = models.IntegerField(default=0)
    description = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sku"]

    def __str__(self):
        return f"{self.sku} - {self.name}"


class InventoryLog(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="inventory_logs")
    quantity = models.IntegerField()
    reason = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.product.sku} -> {self.quantity} ({self.reason})"


class Dealer(models.Model):
    dealer_code = models.CharField(max_length=32, unique=True, db_index=True)
    name = models.CharField(max_length=255)
    city = models.CharField(max_length=100, blank=True, default="")
    phone = models.CharField(max_length=32, blank=True, default="")
    email = models.CharField(max_length=255, blank=True, default="")
    gstin = models.CharField(max_length=32, blank=True, default="")
    credit_limit = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.dealer_code} - {self.name}"


class Order(models.Model):
    STATUS_DRAFT = "DRAFT"
    STATUS_CONFIRMED = "CONFIRMED"
    STATUS_DISPATCHED = "DISPATCHED"
    STATUS_DELIVERED = "DELIVERED"
    STATUS_CANCELLED = "CANCELLED"

    STATUS_CHOICES = [
        (STATUS_DRAFT, "DRAFT"),
        (STATUS_CONFIRMED, "CONFIRMED"),
        (STATUS_DISPATCHED, "DISPATCHED"),
        (STATUS_DELIVERED, "DELIVERED"),
        (STATUS_CANCELLED, "CANCELLED"),
    ]

    order_number = models.CharField(max_length=32, unique=True, db_index=True)
    dealer = models.ForeignKey(Dealer, on_delete=models.PROTECT, related_name="orders")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_DRAFT, db_index=True)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    tax_total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    grand_total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.order_number} ({self.status}) - Dealer {self.dealer_id}"


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="order_items")
    sku = models.CharField(max_length=64)
    name = models.CharField(max_length=255)
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    line_subtotal = models.DecimalField(max_digits=12, decimal_places=2)
    line_tax = models.DecimalField(max_digits=12, decimal_places=2)
    line_total = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.order.order_number}: {self.sku} x {self.quantity}"


class IdempotencyRecord(models.Model):
    key = models.CharField(max_length=255, unique=True, db_index=True)
    request_hash = models.CharField(max_length=64)
    response_status = models.IntegerField()
    response_data = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Idempotency {self.key} -> {self.response_status}"


class DailyOrderSequence(models.Model):
    date = models.DateField(unique=True, db_index=True)
    last_number = models.IntegerField(default=0)

    def __str__(self):
        return f"{self.date}: {self.last_number}"
