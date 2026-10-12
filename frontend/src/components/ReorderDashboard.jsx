import React, { useState, useEffect } from "react";
import { TrendingUp, RefreshCw, AlertTriangle, CheckCircle, ArrowDownToLine, Calendar, ChevronRight } from "lucide-react";

export default function ReorderDashboard() {
  const [reorders, setReorders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedSku, setSelectedSku] = useState(null);
  const [skuForecast, setSkuForecast] = useState(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  const fetchReorders = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/reorder-suggestions/");
      if (res.ok) {
        const data = await res.json();
        setReorders(data.results || []);
      }
    } catch (err) {
      console.error("Failed to fetch reorder suggestions:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReorders();
  }, []);

  const handleInspectForecast = async (sku) => {
    setSelectedSku(sku);
    setForecastLoading(true);
    try {
      const res = await fetch(`/api/forecast/${sku}/`);
      if (res.ok) {
        const data = await res.json();
        setSkuForecast(data.forecast || []);
      }
    } catch (err) {
      console.error("Failed to fetch SKU forecast:", err);
    } finally {
      setForecastLoading(false);
    }
  };

  const handleRunSupplierSync = async () => {
    setSyncLoading(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/sync/supplier/", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setSyncResult({ type: "success", data });
        fetchReorders();
      } else {
        setSyncResult({ type: "error", message: data?.error?.message || "Sync failed" });
      }
    } catch (err) {
      setSyncResult({ type: "error", message: "Network error during sync." });
    } finally {
      setSyncLoading(false);
    }
  };

  // High urgency count (reorder_qty > 0)
  const urgentCount = reorders.filter((r) => r.reorder_qty > 0).length;

  return (
    <div className="animate-fade">
      {/* Top Controls Bar */}
      <div
        className="card"
        style={{
          marginBottom: "1.25rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <h2 style={{ fontSize: "1rem", fontWeight: "700", color: "var(--text-primary)", marginBottom: "0.2rem" }}>
            Reorders & Demand Forecasts
          </h2>
          <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
            Inventory formula: Safety Stock = ⌈1.65 × σ × √L⌉ · Reorder Point = Safety Stock + Lead Time Demand
          </span>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <button onClick={fetchReorders} className="btn-secondary" style={{ padding: "0.45rem 0.85rem", fontSize: "0.8125rem" }}>
            <RefreshCw size={14} /> Refresh Data
          </button>
          <button
            onClick={handleRunSupplierSync}
            disabled={syncLoading}
            className="btn-primary"
            style={{ padding: "0.45rem 0.95rem", fontSize: "0.8125rem" }}
          >
            <ArrowDownToLine size={14} /> {syncLoading ? "Syncing Feed..." : "Run Supplier Sync"}
          </button>
        </div>
      </div>

      {/* Sync result notification */}
      {syncResult && (
        <div
          className={`alert-box ${syncResult.type === "success" ? "alert-success" : "alert-error"}`}
          style={{ marginBottom: "1.25rem" }}
        >
          {syncResult.type === "success" ? (
            <div>
              <strong>Supplier Feed Synchronized:</strong> Created {syncResult.data.created} new parts, Updated {syncResult.data.updated}, Unchanged {syncResult.data.unchanged}, Rejected {syncResult.data.rejected?.length || 0}. ({syncResult.data.requests_made} HTTP requests made across {syncResult.data.pages_fetched} pages).
            </div>
          ) : (
            <div><strong>Supplier Sync Error:</strong> {syncResult.message}</div>
          )}
        </div>
      )}

      {/* Summary Metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", marginBottom: "1.25rem" }}>
        <div className="metric-card">
          <div className="metric-label">Forecasted Catalog</div>
          <div className="metric-value">40 SKUs</div>
          <div className="metric-sub">Full assignment target portfolio</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Items Requiring Reorder</div>
          <div className="metric-value">{urgentCount} SKUs</div>
          <div className="metric-sub">Stock below computed reorder point</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Forecast Horizon</div>
          <div className="metric-value" style={{ fontSize: "1.4rem", marginTop: "0.55rem" }}>4 Weeks</div>
          <div className="metric-sub">28 Sep – 19 Oct 2026 committed</div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div style={{ display: "grid", gridTemplateColumns: selectedSku ? "1fr 340px" : "1fr", gap: "1.25rem", alignItems: "start" }}>
        {/* Reorders Table */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div
            style={{
              padding: "0.85rem 1.25rem",
              borderBottom: "1px solid var(--border-light)",
              fontWeight: "600",
              fontSize: "0.875rem",
              color: "var(--text-primary)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>Target SKUs Reorder Breakdown (40 Items)</span>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: "normal" }}>
              Click Inspect to review 4-week demand prediction
            </span>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
              <RefreshCw className="animate-spin" size={20} style={{ margin: "0 auto 0.5rem auto" }} />
              <div>Computing inventory positions and reorder suggestions...</div>
            </div>
          ) : (
            <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ padding: "0.65rem 0.85rem" }}>SKU</th>
                    <th style={{ padding: "0.65rem 0.65rem" }}>Live Stock</th>
                    <th style={{ padding: "0.65rem 0.65rem" }}>Lead Time</th>
                    <th style={{ padding: "0.65rem 0.65rem" }}>Lead Demand</th>
                    <th style={{ padding: "0.65rem 0.65rem" }}>Safety Stock</th>
                    <th style={{ padding: "0.65rem 0.65rem" }}>Reorder Point</th>
                    <th style={{ padding: "0.65rem 0.65rem" }}>Suggested Order</th>
                    <th style={{ padding: "0.65rem 0.85rem", textAlign: "right" }}>Forecast</th>
                  </tr>
                </thead>
                <tbody>
                  {reorders.map((r) => {
                    const needsReorder = r.reorder_qty > 0;
                    return (
                      <tr
                        key={r.sku}
                        style={{
                          background: selectedSku === r.sku ? "var(--bg-subtle)" : "transparent",
                        }}
                      >
                        <td style={{ padding: "0.65rem 0.85rem", fontFamily: "var(--font-mono)", fontWeight: "600", fontSize: "0.8125rem" }}>
                          {r.sku}
                        </td>
                        <td style={{ padding: "0.65rem 0.65rem", fontWeight: "600", fontSize: "0.85rem" }}>{r.current_stock}</td>
                        <td style={{ padding: "0.65rem 0.65rem", fontSize: "0.85rem", color: "var(--text-secondary)" }}>{r.lead_time_weeks} wk</td>
                        <td style={{ padding: "0.65rem 0.65rem", fontSize: "0.85rem" }}>{r.lead_time_demand}</td>
                        <td style={{ padding: "0.65rem 0.65rem", fontSize: "0.85rem" }}>{r.safety_stock}</td>
                        <td style={{ padding: "0.65rem 0.65rem", fontWeight: "600", fontSize: "0.85rem" }}>{r.reorder_point}</td>
                        <td style={{ padding: "0.65rem 0.65rem" }}>
                          <span className={`badge ${needsReorder ? "badge-urgent" : "badge-optimal"}`}>
                            {needsReorder ? `Order ${r.reorder_qty}` : "Optimal (0)"}
                          </span>
                        </td>
                        <td style={{ padding: "0.65rem 0.85rem", textAlign: "right" }}>
                          <button
                            onClick={() => handleInspectForecast(r.sku)}
                            className="btn-secondary"
                            style={{ padding: "0.25rem 0.55rem", fontSize: "0.75rem" }}
                          >
                            Inspect <ChevronRight size={12} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Forecast Inspection Side Panel */}
        {selectedSku && (
          <div className="card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "0.75rem",
                paddingBottom: "0.5rem",
                borderBottom: "1px solid var(--border-light)",
              }}
            >
              <div>
                <h3 style={{ fontSize: "0.95rem", fontWeight: "700", color: "var(--text-primary)" }}>
                  Forecast: <span style={{ fontFamily: "var(--font-mono)" }}>{selectedSku}</span>
                </h3>
              </div>
              <button
                onClick={() => setSelectedSku(null)}
                style={{ color: "var(--text-muted)", fontSize: "0.85rem", padding: "0.2rem 0.4rem" }}
                title="Close inspection"
              >
                ✕
              </button>
            </div>

            {forecastLoading ? (
              <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                <RefreshCw className="animate-spin" size={16} style={{ margin: "0 auto 0.5rem auto" }} />
                <div>Loading weekly predictions...</div>
              </div>
            ) : skuForecast ? (
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginBottom: "0.75rem" }}>
                  Committed 4-Week Predictions (ml/forecast.csv)
                </span>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {skuForecast.map((f, i) => (
                    <div
                      key={f.week_start}
                      style={{
                        padding: "0.65rem 0.85rem",
                        borderRadius: "var(--radius-sm)",
                        background: "var(--bg-subtle)",
                        border: "1px solid var(--border-light)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                        <Calendar size={13} color="var(--text-muted)" />
                        <span>Week {i + 1} ({f.week_start})</span>
                      </div>
                      <strong style={{ fontSize: "0.875rem", fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>
                        {f.forecast_units} units
                      </strong>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
