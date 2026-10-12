from decimal import Decimal, ROUND_HALF_UP

CENT = Decimal("0.01")
TAX_RATE = Decimal("0.18")


def round_paisa(val: Decimal) -> Decimal:
    """Rounds a Decimal to exactly two decimal places using Indian GST standard ROUND_HALF_UP."""
    return val.quantize(CENT, rounding=ROUND_HALF_UP)


def format_money(val: Decimal) -> str:
    """Formats a Decimal as string with exactly two decimal places, e.g. '1459.50'."""
    return f"{round_paisa(val):.2f}"


def calculate_line_item(unit_price: Decimal, quantity: int) -> dict:
    """
    Computes subtotal, tax and total for an order line item.
    Tax is 18% calculated and rounded per line using ROUND_HALF_UP.
    """
    qty = Decimal(quantity)
    line_subtotal = round_paisa(unit_price * qty)
    line_tax = round_paisa(line_subtotal * TAX_RATE)
    line_total = line_subtotal + line_tax
    return {
        "unit_price": unit_price,
        "quantity": quantity,
        "line_subtotal": line_subtotal,
        "line_tax": line_tax,
        "line_total": line_total,
    }


def calculate_order_totals(calculated_lines: list[dict]) -> dict:
    """
    Sums subtotal, tax_total and grand_total across all calculated line items.
    grand_total = subtotal + tax_total.
    """
    subtotal = sum((line["line_subtotal"] for line in calculated_lines), Decimal("0.00"))
    tax_total = sum((line["line_tax"] for line in calculated_lines), Decimal("0.00"))
    grand_total = subtotal + tax_total
    return {
        "subtotal": round_paisa(subtotal),
        "tax_total": round_paisa(tax_total),
        "grand_total": round_paisa(grand_total),
    }
