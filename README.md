# VIKMO DealerDesk — AI-Native Commerce Operating System

> **Submission Track:** Unified Submission (Django Intern & AI / ML Intern Tracks + Frontend Bonus)  
> **LLM Provider:** Google Gemini / Groq / OpenAI (Configurable via environment variables)  
> **Database:** PostgreSQL (PostgreSQL 16)  
> **Status:** All Required & Bonus Endpoints Implemented (12/12 Smoke Test Checks Passing, 16/16 Pytest Suite Passing)

---

## 1. Overview

**VIKMO DealerDesk** is a commerce operating system designed for Indian automotive and motorcycle parts distributors supplying **25 regional dealers** from a catalogue of **600 products**.

The system addresses four critical business challenges:
1. **Overselling & GST Precision:** Concurrency-safe order engine (`SELECT ... FOR UPDATE`), exact 18% GST calculation (`ROUND_HALF_UP` to the paisa), and unique daily sequential order numbering (`ORD-YYYYMMDD-NNNN`).
2. **Resilient Supplier Synchronization:** Cursor-paginated ingestion client handling rate limits (`429` with `Retry-After`), exponential backoff on `5xx` transient errors, deduplication by latest `updated_at`, and all-or-nothing rollback on failure.
3. **Conversational Dealer Assistant:** Multi-turn conversational LLM agent supporting function calling (`search_parts`, `check_stock`, `create_draft_order`), real-time database-grounded inventory figures, clarification of ambiguous queries, and hardened defenses against adversarial prompt injections embedded in supplier descriptions.
4. **Demand Forecasting & Deterministic Reordering:** 4-week demand forecasting for 40 SKUs across `2026-09-28` to `2026-10-19` without future-data leakage (handling promotions, floating Diwali festival shifts, rare SKUs, and new products), beating 3 historical baselines, and computing exact safety stock and reorder points.
5. **Interactive Dealer Portal (Frontend):** Modern web dashboard allowing dealers to search the live catalogue, inspect real-time warehouse inventory, manage draft and confirmed orders, chat with the AI assistant, and inspect automated reorder recommendations.

---

## 2. Quickstart & Grader Run Contract

The application adheres strictly to the automated grading contract on Linux:

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Run database migrations (PostgreSQL)
python manage.py migrate --noinput

# 3. Seed data idempotently (safe to run repeatedly without duplicates)
python manage.py seed_data
python manage.py seed_data

# 4. Start backend server
python manage.py runserver 0.0.0.0:8000 --noreload
```

### Environment Configuration (`.env`)
Copy `.env.example` to `.env` and configure your database and optional LLM keys:
```env
DATABASE_URL=postgres://localhost:5432/dealerdesk
SUPPLIER_API_URL=http://127.0.0.1:8099
SUPPLIER_API_KEY=dev-supplier-key
DJANGO_SECRET_KEY=vikmo-dealerdesk-dev-key
DJANGO_DEBUG=1

# Optional live LLM API keys:
GEMINI_API_KEY=
GROQ_API_KEY=
OPENAI_API_KEY=
```
*(Note: If no LLM key is configured, the Dealer Assistant operates in high-fidelity deterministic fallback mode, ensuring that smoke tests, tool executions, and business rules remain 100% testable without external credentials).*

---

## 3. Running Verification & Smoke Tests

### Official Smoke Test Suite
Ensure the mock supplier and Django server are active:
```bash
# Terminal 1: Start Supplier Mock
python supplier_mock/mock_supplier.py --calm

# Terminal 2: Start Django Server
python manage.py runserver 0.0.0.0:8000 --noreload

# Terminal 3: Run Smoke Test against a freshly seeded database
python manage.py flush --noinput && python manage.py seed_data

# Run tests for specific tracks or all parts:
python smoke_test.py --base-url http://localhost:8000 --track django
python smoke_test.py --base-url http://localhost:8000 --track aiml
python smoke_test.py --base-url http://localhost:8000 --all
```

**Result:**
```
DealerDesk smoke test against http://localhost:8000 (parts: assistant, core, engine, forecast, sync)
Core
  [PASS] GET /api/health/
  [PASS] GET /api/products/ (pagination, fields, 600 seeded)
  [PASS] GET /api/products/{sku}/ and 404 error shape
  [PASS] Dealers: list (25 seeded) and create
  [PASS] PUT /api/inventory/{sku}/
  [PASS] POST /api/orders/ creates a DRAFT (shape, money format)
  [PASS] Validation error shape (empty items)
Order engine
  [PASS] Confirm, cancel and an invalid transition
Supplier sync
  [PASS] POST /api/sync/supplier/ (response shape only)
Dealer Assistant
  [PASS] POST /api/assistant/chat/ (response shape only)
Forecasting
  [PASS] ml/forecast.csv (columns, 160 rows, weeks)
  [PASS] GET /api/forecast/{sku}/ and /api/reorder-suggestions/ (shape only)
12/12 checks passed.
```

### Automated Pytest Suite
Run the 16 automated unit, integration, and multi-threaded concurrency tests:
```bash
pytest
```
**Coverage includes:**
- Multi-threaded concurrent order confirmation simulating race conditions to verify zero overselling.
- GST calculation and exact `ROUND_HALF_UP` boundary rounding tests.
- Model constraints, uniqueness, and `on_delete` foreign key protection.
- Supplier sync price validation, timestamp ordering, and stock preservation.
- Prompt injection resistance and ambiguity handling in Dealer Assistant.
- Exact safety stock and reorder formula verification.

---

## 4. Key Endpoints Implemented

| Endpoint | Method | Description |
|---|---|---|
| `/api/health/` | `GET` | System health check (`200 {"status": "ok"}`) |
| `/api/products/` | `GET`, `POST` | Paginated product catalogue with `search`, `category`, and `vehicle` filters |
| `/api/products/{sku}/` | `GET`, `PATCH` | Product detail and partial attribute update |
| `/api/inventory/{sku}/` | `PUT` | Live warehouse stock adjustment |
| `/api/dealers/` | `GET`, `POST` | Paginated dealer directory and creation |
| `/api/dealers/{id}/` | `GET` | Dealer profile detail |
| `/api/orders/` | `GET`, `POST` | Paginated orders and DRAFT order creation with `Idempotency-Key` |
| `/api/orders/{order_number}/` | `GET`, `PUT` | Order detail and item replacement (DRAFT only) |
| `/api/orders/{order_number}/confirm/` | `POST` | Atomic all-or-nothing confirmation & stock deduction |
| `/api/orders/{order_number}/cancel/` | `POST` | Order cancellation (restores confirmed stock exactly once) |
| `/api/orders/{order_number}/dispatch/` | `POST` | Status transition: `CONFIRMED` $\to$ `DISPATCHED` |
| `/api/orders/{order_number}/deliver/` | `POST` | Status transition: `DISPATCHED` $\to$ `DELIVERED` |
| `/api/sync/supplier/` | `POST` | Supplier catalogue sync with retry, backoff, and deduplication |
| `/api/assistant/chat/` | `POST` | AI conversational assistant with tool calling and injection defenses |
| `/api/forecast/{sku}/` | `GET` | 4-week demand predictions for forecast SKUs |
| `/api/reorder-suggestions/` | `GET` | 40-item automated safety stock & reorder recommendations |

---

## 5. Architectural Highlights & Decisions

Full technical defenses with file and line citations are provided in [DECISIONS.md](file:///Users/sridevi/Downloads/VIKMO%20DealerDesk%20Assignment/DECISIONS.md):

- **Concurrency & Deadlock Prevention:** `core/services/order_service.py` sorts SKUs alphabetically before executing `Product.objects.select_for_update()` within an atomic transaction.
- **Paisa Precision:** `core/services/gst_calculator.py` quantizes each line's 18% tax using `Decimal.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)`.
- **Supplier Feed Deduplication:** `core/services/sync_service.py` resolves cross-page duplicates by comparing ISO timestamps, retaining the latest `updated_at`.
- **Prompt Injection Defense:** In `core/services/assistant_service.py`, supplier catalogue content is treated as passive data within XML delimiters. The model is given **no tool to confirm orders**, rendering unauthorized confirmations structurally impossible.
- **Leakage-Free Demand Forecasting:** `ml/train_forecast.py` strictly backtests on past dates, floating Diwali distance features across moving years, and accounts for the 2.22x promotion surge. Output is committed in `ml/forecast.csv` (160 rows).

---

## 6. Video Walkthrough Outline

> **Demo Video URL:** `[PLACEHOLDER: Insert unlisted video link here (YouTube / Loom / Google Drive) before final submission]`

### 5-Minute Walkthrough Structure:
1. **0:00 - 1:00:** Problem statement, architecture overview, and clean run contract compliance.
2. **1:00 - 2:30 (Django Track Focus):** Walkthrough of `confirm_order` in `core/services/order_service.py`, line by line:
   - Atomic transaction entry.
   - Alphabetical SKU sorting and pessimistic row locking (`SELECT ... FOR UPDATE`).
   - All-or-nothing stock availability check.
   - Atomic decrement and unit price locking.
   - Live pytest multi-threading demonstration proving zero overselling under race conditions.
3. **2:30 - 4:00 (AI/ML Track Focus):** Dealer Assistant and Forecasting:
   - Tool calling loop (`search_parts`, `check_stock`, `create_draft_order`).
   - Demonstration of prompt injection defense rejecting malicious code `VIKMO-FREE-90` from SKU `CHN-1037`.
   - Leakage barrier line citation in `ml/train_forecast.py` and benchmark comparison against 3 baselines.
4. **4:00 - 5:00:** Reorder suggestions formula execution and interactive Frontend Dealer Portal demo.
