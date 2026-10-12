from decimal import Decimal
from datetime import datetime, timezone
import pytest
from core.models import Product
from core.services.sync_service import (
    validate_item_price,
    parse_timestamp,
    run_supplier_sync,
    SupplierSyncException,
)


def test_validate_item_price():
    # Valid positive prices with <= 2 decimals
    ok, val = validate_item_price("1459.50")
    assert ok is True
    assert val == Decimal("1459.50")

    ok, val = validate_item_price(100)
    assert ok is True
    assert val == Decimal("100.00")

    # Invalid: 0 or negative
    ok, _ = validate_item_price("0.00")
    assert ok is False

    ok, _ = validate_item_price("-15.00")
    assert ok is False

    # Invalid: more than 2 decimals
    ok, _ = validate_item_price("12.345")
    assert ok is False

    # Invalid: non-numeric string
    ok, _ = validate_item_price("N/A")
    assert ok is False


def test_parse_timestamp():
    dt1 = parse_timestamp("2026-10-08T09:15:00Z")
    assert dt1.year == 2026
    assert dt1.month == 10

    dt2 = parse_timestamp("invalid-date")
    assert dt2 == datetime.min


@pytest.mark.django_db
def test_sync_never_modifies_existing_stock(monkeypatch):
    # Setup product with existing stock = 42
    p = Product.objects.create(
        sku="TEST-SYNC-1",
        name="Old Name",
        category="Brakes",
        brand="Endurance",
        vehicle_fitment="Pulsar 150",
        price=Decimal("1000.00"),
        stock=42,
    )

    # Mock response from supplier with supplier_stock = 999
    feed_item = {
        "supplier_sku": "SUP-101",
        "sku": "TEST-SYNC-1",
        "name": "Updated Name",
        "category": "Brakes",
        "brand": "Endurance",
        "vehicle_fitment": "Pulsar 150",
        "description": "Updated description",
        "price": "1200.00",
        "supplier_stock": 999,
        "updated_at": "2026-10-08T10:00:00Z",
    }

    class MockResponse:
        status_code = 200
        headers = {}
        def json(self):
            return {"items": [feed_item], "next_cursor": None}

    class MockSession:
        headers = {}
        def get(self, *args, **kwargs):
            return MockResponse()

    monkeypatch.setattr("requests.Session", lambda: MockSession())

    result = run_supplier_sync()
    assert result["updated"] == 1
    assert result["created"] == 0
    assert result["unchanged"] == 0

    p.refresh_from_db()
    assert p.name == "Updated Name"
    assert p.price == Decimal("1200.00")
    # Stock must strictly remain 42! Never changed to supplier_stock 999
    assert p.stock == 42
