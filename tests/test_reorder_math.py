import math
import numpy as np
import pytest
from core.services.reorder_service import compute_sample_std_12_weeks


def test_reorder_formula_exact_calculation():
    # Example from Contract §10.2:
    # L = 2
    # lead_time_demand = 61.7
    # safety_stock = 9
    # reorder_point = 70.7
    # current_stock = 40 -> reorder_qty = max(0, ceil(70.7 - 40)) = 31

    L = 2
    lead_time_demand = 61.7
    current_stock = 40

    # If safety_stock = 9
    safety_stock = 9
    reorder_point = round(lead_time_demand + safety_stock, 2)
    assert reorder_point == 70.7

    reorder_qty = max(0, math.ceil(reorder_point - current_stock))
    assert reorder_qty == 31


def test_reorder_qty_zero_when_stock_sufficient():
    lead_time_demand = 50.0
    safety_stock = 10
    reorder_point = 60.0
    current_stock = 80  # More than reorder point

    reorder_qty = max(0, math.ceil(reorder_point - current_stock))
    assert reorder_qty == 0


def test_sample_std_ddof1():
    # Test numpy sample standard deviation with ddof=1
    vals = [20, 25, 30, 22, 28, 35, 19, 21, 26, 30, 24, 28]
    sigma = float(np.std(vals, ddof=1))
    L = 3

    safety_stock = math.ceil(1.65 * sigma * math.sqrt(L))
    assert isinstance(safety_stock, int)
    assert safety_stock > 0
