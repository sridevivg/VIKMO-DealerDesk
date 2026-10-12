# VIKMO DealerDesk — Frontend Dealer Portal

A modern web dashboard built with React and Vite providing an intuitive graphical interface for South Indian automotive parts distributors and dealers.

## Features
- **Live Catalogue & Stock Search:** Filter across 600 products by search query, 11 categories, and vehicle models with real-time warehouse stock indicators.
- **Stock Adjustment Modal:** Direct integration with `PUT /api/inventory/{sku}/` to adjust physical warehouse counts.
- **Cart & Order Flow:** Select from 25 dealers, assemble items, and create DRAFT orders.
- **Order Lifecycle & GST Breakdown:** Full visibility of subtotal, per-line 18% GST (rounded to the paisa), grand total, and actionable state transitions (`confirm`, `cancel`, `dispatch`, `deliver`) with error handling.
- **Conversational Dealer Assistant:** Multi-turn chat interface with tool execution badges and prompt injection testing presets.
- **Demand Forecasting & Reorders:** Visual inspection of all 40 forecast SKUs, safety stock math, and one-click supplier sync trigger.

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Start Vite development server
npm run dev
```

The portal runs on `http://localhost:3000` and automatically proxies all `/api/*` calls to the Django backend running on port `8000`.
