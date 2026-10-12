import concurrent.futures
from decimal import Decimal
import pytest
from django.db import connection
from core.models import Product, Dealer, Order
from core.services.order_service import (
    create_draft_order,
    confirm_order,
    cancel_order,
    OrderServiceException,
)


@pytest.mark.django_db(transaction=True)
def test_concurrent_order_confirmations_prevent_overselling():
    # Setup: 1 product with 2 units available
    dealer = Dealer.objects.create(dealer_code="DLR-CONC-1", name="Concurrency Dealer")
    product = Product.objects.create(
        sku="CONC-SKU-1",
        name="Scarce Part",
        category="Brakes",
        brand="Endurance",
        vehicle_fitment="Pulsar 150",
        price=Decimal("1000.00"),
        stock=2,
    )

    # Create 5 separate DRAFT orders for 1 unit each
    order_numbers = []
    for _ in range(5):
        order, _ = create_draft_order(
            dealer_id=dealer.id,
            items_data=[{"sku": product.sku, "quantity": 1}],
        )
        order_numbers.append(order.order_number)

    # Function executed concurrently across threads
    def attempt_confirm(ord_no):
        connection.close()  # Ensure each thread uses its own DB connection
        try:
            res = confirm_order(ord_no)
            return True, res.order_number
        except OrderServiceException as e:
            return False, e.code

    # Execute all 5 confirm attempts simultaneously
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        results = list(executor.map(attempt_confirm, order_numbers))

    successes = [r for r in results if r[0] is True]
    failures = [r for r in results if r[0] is False]

    # Exactly 2 orders must succeed, 3 must fail with INSUFFICIENT_STOCK
    assert len(successes) == 2, f"Expected 2 successes, got {len(successes)}"
    assert len(failures) == 3, f"Expected 3 failures, got {len(failures)}"
    for f in failures:
        assert f[1] == "INSUFFICIENT_STOCK"

    # Stock must be exactly 0, never negative
    product.refresh_from_db()
    assert product.stock == 0

    # Cancelling 1 confirmed order restores stock to 1
    confirmed_order_no = successes[0][1]
    cancel_order(confirmed_order_no)
    product.refresh_from_db()
    assert product.stock == 1

    # Cancelling again must fail with INVALID_TRANSITION
    with pytest.raises(OrderServiceException) as exc:
        cancel_order(confirmed_order_no)
    assert exc.value.code == "INVALID_TRANSITION"
