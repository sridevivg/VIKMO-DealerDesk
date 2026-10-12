from decimal import Decimal
import pytest
from core.services.gst_calculator import (
    calculate_line_item,
    calculate_order_totals,
    format_money,
    round_paisa,
)


def test_gst_line_item_calculation():
    # Unit price = 1459.50, quantity = 3
    # Subtotal = 4378.50
    # Tax = 4378.50 * 0.18 = 788.13
    # Total = 5166.63
    unit_price = Decimal("1459.50")
    qty = 3
    result = calculate_line_item(unit_price, qty)

    assert result["line_subtotal"] == Decimal("4378.50")
    assert result["line_tax"] == Decimal("788.13")
    assert result["line_total"] == Decimal("5166.63")
    assert format_money(result["line_tax"]) == "788.13"
    assert format_money(result["line_total"]) == "5166.63"


def test_gst_round_half_up_boundary():
    # Test boundary where 0.005 rounds up to 0.01
    val = Decimal("10.005")
    assert round_paisa(val) == Decimal("10.01")

    # In Python float / Banker's rounding, Decimal("10.0050") with ROUND_HALF_EVEN
    # would round to 10.00 because 0 is even.
    # ROUND_HALF_UP guarantees 10.01.
    val_even = Decimal("2.005")
    assert round_paisa(val_even) == Decimal("2.01")


def test_order_totals_aggregation():
    # Line 1: 1459.50 x 3
    line1 = calculate_line_item(Decimal("1459.50"), 3)
    # Line 2: 250.00 x 2 -> subtotal 500.00, tax 90.00, total 590.00
    line2 = calculate_line_item(Decimal("250.00"), 2)

    totals = calculate_order_totals([line1, line2])
    assert totals["subtotal"] == Decimal("4878.50")
    assert totals["tax_total"] == Decimal("878.13")
    assert totals["grand_total"] == Decimal("5756.63")
