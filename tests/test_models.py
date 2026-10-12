from decimal import Decimal
import pytest
from django.db import IntegrityError
from core.models import Product, Dealer, Order, OrderItem, DailyOrderSequence, IdempotencyRecord


@pytest.mark.django_db
def test_product_creation_and_uniqueness():
    p1 = Product.objects.create(
        sku="TEST-001",
        name="Test Brake Pad",
        category="Brakes",
        brand="Endurance",
        vehicle_fitment="Bajaj Pulsar 150",
        price=Decimal("1459.50"),
        stock=10,
    )
    assert p1.sku == "TEST-001"
    assert str(p1) == "TEST-001 - Test Brake Pad"

    # Duplicate SKU must raise IntegrityError
    with pytest.raises(IntegrityError):
        Product.objects.create(
            sku="TEST-001",
            name="Duplicate Pad",
            category="Brakes",
            brand="Endurance",
            vehicle_fitment="Bajaj Pulsar 150",
            price=Decimal("1200.00"),
            stock=5,
        )


@pytest.mark.django_db
def test_dealer_creation_and_uniqueness():
    d1 = Dealer.objects.create(
        dealer_code="DLR-TEST-1",
        name="Speedy Spares",
        city="Bengaluru",
        credit_limit=Decimal("100000.00"),
    )
    assert d1.dealer_code == "DLR-TEST-1"
    assert str(d1) == "DLR-TEST-1 - Speedy Spares"

    with pytest.raises(IntegrityError):
        Dealer.objects.create(
            dealer_code="DLR-TEST-1",
            name="Duplicate Dealer",
        )


@pytest.mark.django_db
def test_order_foreign_key_on_delete_protect():
    d = Dealer.objects.create(dealer_code="DLR-DEL-1", name="Delete Dealer")
    p = Product.objects.create(
        sku="TEST-PROT-1",
        name="Protect Product",
        category="Brakes",
        brand="Endurance",
        vehicle_fitment="Universal",
        price=Decimal("500.00"),
        stock=20,
    )

    order = Order.objects.create(
        order_number="ORD-20261012-9999",
        dealer=d,
        status=Order.STATUS_DRAFT,
    )
    OrderItem.objects.create(
        order=order,
        product=p,
        sku=p.sku,
        name=p.name,
        quantity=2,
        unit_price=p.price,
        line_subtotal=Decimal("1000.00"),
        line_tax=Decimal("180.00"),
        line_total=Decimal("1180.00"),
    )

    # Deleting dealer or product must be protected
    with pytest.raises(Exception):
        d.delete()

    with pytest.raises(Exception):
        p.delete()
