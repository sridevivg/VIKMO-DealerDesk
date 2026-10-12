from decimal import Decimal
from rest_framework import serializers
from core.models import Product, Dealer, Order, OrderItem
from core.services.gst_calculator import format_money


class ProductSerializer(serializers.ModelSerializer):
    price = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "sku",
            "name",
            "category",
            "brand",
            "vehicle_fitment",
            "price",
            "stock",
            "description",
        ]

    def get_price(self, obj):
        return format_money(obj.price)


class ProductCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = [
            "sku",
            "name",
            "category",
            "brand",
            "vehicle_fitment",
            "price",
            "description",
        ]

    def validate_price(self, value):
        if value <= Decimal("0.00"):
            raise serializers.ValidationError("Price must be greater than 0.")
        # check at most 2 decimal places
        if value.as_tuple().exponent < -2:
            raise serializers.ValidationError("Price must have at most 2 decimal places.")
        return value


class DealerSerializer(serializers.ModelSerializer):
    credit_limit = serializers.SerializerMethodField()

    class Meta:
        model = Dealer
        fields = [
            "id",
            "dealer_code",
            "name",
            "city",
            "phone",
            "email",
            "gstin",
            "credit_limit",
        ]

    def get_credit_limit(self, obj):
        return format_money(obj.credit_limit)


class DealerCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Dealer
        fields = [
            "dealer_code",
            "name",
            "city",
            "phone",
            "email",
            "gstin",
            "credit_limit",
        ]
        extra_kwargs = {
            "city": {"required": False},
            "phone": {"required": False},
            "email": {"required": False},
            "gstin": {"required": False},
            "credit_limit": {"required": False},
        }


class OrderItemSerializer(serializers.ModelSerializer):
    unit_price = serializers.SerializerMethodField()
    line_subtotal = serializers.SerializerMethodField()
    line_tax = serializers.SerializerMethodField()
    line_total = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = [
            "sku",
            "name",
            "quantity",
            "unit_price",
            "line_subtotal",
            "line_tax",
            "line_total",
        ]

    def get_unit_price(self, obj):
        return format_money(obj.unit_price)

    def get_line_subtotal(self, obj):
        return format_money(obj.line_subtotal)

    def get_line_tax(self, obj):
        return format_money(obj.line_tax)

    def get_line_total(self, obj):
        return format_money(obj.line_total)


class OrderSerializer(serializers.ModelSerializer):
    dealer_id = serializers.IntegerField(source="dealer.id")
    items = OrderItemSerializer(many=True, read_only=True)
    subtotal = serializers.SerializerMethodField()
    tax_total = serializers.SerializerMethodField()
    grand_total = serializers.SerializerMethodField()
    created_at = serializers.DateTimeField(format="%Y-%m-%dT%H:%M:%S%z")
    updated_at = serializers.DateTimeField(format="%Y-%m-%dT%H:%M:%S%z")

    class Meta:
        model = Order
        fields = [
            "order_number",
            "dealer_id",
            "status",
            "items",
            "subtotal",
            "tax_total",
            "grand_total",
            "created_at",
            "updated_at",
        ]

    def get_subtotal(self, obj):
        return format_money(obj.subtotal)

    def get_tax_total(self, obj):
        return format_money(obj.tax_total)

    def get_grand_total(self, obj):
        return format_money(obj.grand_total)
