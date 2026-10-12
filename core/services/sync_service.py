import time
import requests
from decimal import Decimal, InvalidOperation
from datetime import datetime
from django.conf import settings
from django.db import transaction
from core.models import Product


class SupplierSyncException(Exception):
    def __init__(self, message: str, status_code: int = 502, code: str = "SUPPLIER_UNAVAILABLE"):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.code = code


def parse_timestamp(ts_str: str) -> datetime:
    """Parses ISO timestamp string to datetime for updated_at comparisons."""
    try:
        # Normalize trailing Z to +00:00
        if ts_str.endswith("Z"):
            ts_str = ts_str[:-1] + "+00:00"
        return datetime.fromisoformat(ts_str)
    except Exception:
        return datetime.min


def validate_item_price(price_val) -> tuple[bool, Decimal]:
    """
    Checks that price is a positive amount with at most 2 decimals.
    Returns (is_valid, Decimal_value).
    """
    if price_val is None:
        return False, Decimal("0.00")
    try:
        dec = Decimal(str(price_val).strip())
        if dec <= Decimal("0.00"):
            return False, Decimal("0.00")
        if dec.as_tuple().exponent < -2:
            return False, Decimal("0.00")
        return True, dec
    except (InvalidOperation, ValueError, TypeError):
        return False, Decimal("0.00")


def run_supplier_sync() -> dict:
    """
    Executes a complete supplier catalogue sync according to Contract §8.
    - Follows cursor pagination until next_cursor is null.
    - Retries up to 5 times per request on 429 (respecting Retry-After) or 5xx/network errors.
    - All-or-nothing: if any request fails after 5 retries, changes nothing and raises 502.
    - Skips invalid items into rejected.
    - Deduplicates by sku using latest updated_at.
    - Applies updates/creates without modifying local stock.
    """
    base_url = getattr(settings, "SUPPLIER_API_URL", "http://127.0.0.1:8099").rstrip("/")
    api_key = getattr(settings, "SUPPLIER_API_KEY", "dev-supplier-key")

    cursor = None
    all_raw_items = []
    pages_fetched = 0
    requests_made = 0

    session = requests.Session()
    session.headers.update({"X-Api-Key": api_key})

    # 1. Pagination & Ingestion loop
    while True:
        url = f"{base_url}/v1/products"
        params = {"limit": 20}
        if cursor:
            params["cursor"] = cursor

        success = False
        last_error = None

        for attempt in range(1, 6):
            requests_made += 1
            try:
                response = session.get(url, params=params, timeout=20)
                if response.status_code == 200:
                    pages_fetched += 1
                    data = response.json()
                    items = data.get("items", [])
                    all_raw_items.extend(items)
                    cursor = data.get("next_cursor")
                    success = True
                    break
                elif response.status_code == 429:
                    retry_after = int(response.headers.get("Retry-After", 1))
                    time.sleep(retry_after)
                    continue
                elif response.status_code in (500, 502, 503):
                    time.sleep(0.5 * attempt)
                    continue
                elif response.status_code == 401:
                    raise SupplierSyncException("Supplier API key rejected (401).")
                else:
                    last_error = f"HTTP {response.status_code}"
                    time.sleep(0.5)
            except requests.RequestException as e:
                last_error = str(e)
                time.sleep(0.5 * attempt)

        if not success:
            raise SupplierSyncException(f"Failed to fetch supplier feed page after 5 attempts: {last_error}")

        if not cursor:
            break

    # 2. Validation & Filtering of invalid items
    valid_items = []
    rejected = []

    for item in all_raw_items:
        supplier_sku = item.get("supplier_sku") or "UNKNOWN"
        sku = item.get("sku")
        if not sku or not isinstance(sku, str) or not sku.strip():
            rejected.append({"supplier_sku": supplier_sku, "reason": "missing or empty sku"})
            continue

        price_valid, dec_price = validate_item_price(item.get("price"))
        if not price_valid:
            rejected.append({"supplier_sku": supplier_sku, "reason": "invalid price"})
            continue

        item_copy = dict(item)
        item_copy["sku"] = sku.strip()
        item_copy["price_dec"] = dec_price
        item_copy["dt_updated"] = parse_timestamp(item.get("updated_at", ""))
        valid_items.append(item_copy)

    # 3. Deduplication: group by SKU and pick latest updated_at
    items_by_sku = {}
    for item in valid_items:
        sku = item["sku"]
        if sku not in items_by_sku:
            items_by_sku[sku] = item
        else:
            if item["dt_updated"] > items_by_sku[sku]["dt_updated"]:
                items_by_sku[sku] = item

    unique_items = list(items_by_sku.values())

    # 4. Apply to database in a single atomic transaction (never modifying stock)
    created_count = 0
    updated_count = 0
    unchanged_count = 0

    with transaction.atomic():
        existing_products = {p.sku: p for p in Product.objects.filter(sku__in=items_by_sku.keys())}

        for item in unique_items:
            sku = item["sku"]
            name = item.get("name", "").strip()
            category = item.get("category", "").strip()
            brand = item.get("brand", "").strip()
            vehicle_fitment = item.get("vehicle_fitment", "").strip()
            description = item.get("description", "").strip()
            price = item["price_dec"]

            if sku not in existing_products:
                Product.objects.create(
                    sku=sku,
                    name=name,
                    category=category,
                    brand=brand,
                    vehicle_fitment=vehicle_fitment,
                    description=description,
                    price=price,
                    stock=0,  # Contract §8.6: new products get stock 0
                )
                created_count += 1
            else:
                prod = existing_products[sku]
                has_diff = (
                    prod.name != name
                    or prod.category != category
                    or prod.brand != brand
                    or prod.vehicle_fitment != vehicle_fitment
                    or prod.description != description
                    or prod.price != price
                )

                if has_diff:
                    prod.name = name
                    prod.category = category
                    prod.brand = brand
                    prod.vehicle_fitment = vehicle_fitment
                    prod.description = description
                    prod.price = price
                    prod.save(update_fields=["name", "category", "brand", "vehicle_fitment", "description", "price", "updated_at"])
                    updated_count += 1
                else:
                    unchanged_count += 1

    return {
        "created": created_count,
        "updated": updated_count,
        "unchanged": unchanged_count,
        "rejected": rejected,
        "pages_fetched": pages_fetched,
        "requests_made": requests_made,
    }
