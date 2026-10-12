import csv
import math
from pathlib import Path
from decimal import Decimal
import numpy as np
from django.conf import settings
from core.models import Product


def get_forecast_file_path() -> Path:
    return Path(settings.BASE_DIR) / "ml" / "forecast.csv"


def get_data_dir() -> Path:
    return getattr(settings, "DATA_DIR", Path(settings.BASE_DIR) / "data")


def load_forecast_data() -> dict[str, list[dict]]:
    """
    Loads ml/forecast.csv and indexes predictions by SKU.
    Returns: {sku: [{"week_start": "2026-09-28", "forecast_units": 31.4}, ...]}
    """
    forecast_file = get_forecast_file_path()
    if not forecast_file.exists():
        return {}

    by_sku = {}
    with open(forecast_file, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            sku = row["sku"].strip()
            w_start = row["week_start"].strip()
            units = float(row["forecast_units"].strip())
            by_sku.setdefault(sku, []).append({
                "week_start": w_start,
                "forecast_units": units,
            })
    return by_sku


def load_lead_times() -> list[dict]:
    """
    Loads data/lead_times.csv defining the 40 forecast SKUs and lead times.
    """
    lead_file = get_data_dir() / "lead_times.csv"
    if not lead_file.exists():
        return []

    leads = []
    with open(lead_file, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            leads.append({
                "sku": row["sku"].strip(),
                "lead_time_weeks": int(row["lead_time_weeks"].strip()),
            })
    return leads


def compute_sample_std_12_weeks(sku: str) -> float:
    """
    Computes sample standard deviation (ddof=1, n-1) of units_sold over the most recent 12 weeks
    of sales_history.csv for that SKU (all available weeks if fewer than 12).
    """
    sales_file = get_data_dir() / "sales_history.csv"
    if not sales_file.exists():
        return 0.0

    history_rows = []
    with open(sales_file, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row["sku"].strip() == sku:
                history_rows.append((row["week_start"].strip(), float(row["units_sold"].strip())))

    if not history_rows:
        return 0.0

    # Sort chronologically and take last 12 weeks
    history_rows.sort(key=lambda x: x[0])
    recent_12 = history_rows[-12:]
    units = [r[1] for r in recent_12]

    if len(units) <= 1:
        return 0.0

    # Sample standard deviation (n - 1)
    return float(np.std(units, ddof=1))


def get_reorder_suggestions() -> list[dict]:
    """
    Computes reorder suggestions for all 40 forecast SKUs using the exact formula from Contract §10.2:
    - L = lead_time_weeks from data/lead_times.csv
    - lead_time_demand = sum of forecast_units for the first L forecast weeks
    - sigma = sample standard deviation (n - 1) over most recent 12 weeks of sales_history.csv
    - safety_stock = ceil(1.65 * sigma * sqrt(L))
    - reorder_point = lead_time_demand + safety_stock
    - reorder_qty = max(0, ceil(reorder_point - current_stock))
    - current_stock = live available stock at time of request
    """
    leads = load_lead_times()
    forecasts = load_forecast_data()

    # Pre-fetch live stocks for forecast SKUs
    lead_skus = [x["sku"] for x in leads]
    live_stocks = {p.sku: p.stock for p in Product.objects.filter(sku__in=lead_skus)}

    results = []
    for item in leads:
        sku = item["sku"]
        L = item["lead_time_weeks"]
        current_stock = live_stocks.get(sku, 0)

        # First L weeks of forecast
        sku_forecast = forecasts.get(sku, [])
        first_L_weeks = sku_forecast[:L]
        lead_time_demand = round(sum(w["forecast_units"] for w in first_L_weeks), 2)

        # Sigma over last 12 weeks of history
        sigma = compute_sample_std_12_weeks(sku)

        # Safety stock = ceil(1.65 * sigma * sqrt(L))
        safety_stock = math.ceil(1.65 * sigma * math.sqrt(L))

        # Reorder point = lead_time_demand + safety_stock
        reorder_point = round(lead_time_demand + safety_stock, 2)

        # Reorder qty = max(0, ceil(reorder_point - current_stock))
        reorder_qty = max(0, math.ceil(reorder_point - current_stock))

        results.append({
            "sku": sku,
            "current_stock": current_stock,
            "lead_time_weeks": L,
            "lead_time_demand": lead_time_demand,
            "safety_stock": safety_stock,
            "reorder_point": reorder_point,
            "reorder_qty": reorder_qty,
        })

    return results
