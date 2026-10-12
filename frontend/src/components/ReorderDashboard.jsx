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
      <div className="card" style={{ marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h2 style={{ fontSize: "1.2rem", fontWeight: "700" }}>Inventory Demand & Reorders</h2>
          <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            Calculated via Contract §10.2: Safety Stock ⌈1.65 × σ × √L⌉ & Lead Time Demand
          </span>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <button onClick={fetchReorders} className="btn-secondary" style={{ padding: "0.5rem 0.9rem" }}>
            <RefreshCw size={15} /> Refresh Data
          </button>
          <button onClick={handleRunSupplierSync} disabled={syncLoading} className="btn-primary" style={{ padding: "0.5rem 1rem" }}>
            <ArrowDownToLine size={16} /> {syncLoading ? "Syncing Feed..." : "Run Supplier Sync"}
          </button>
        </div>
      </div>

      {/* Sync result alert */}
      {syncResult && (
        <div style={{
          marginBottom: "1.5rem", padding: "1rem", borderRadius: "8px",
          background: syncResult.type === "success" ? "var(--success-bg)" : "var(--danger-bg)",
          color: syncResult.type === "success" ? "var(--success)" : "var(--danger)",
          border: `1px solid ${syncResult.type === "success" ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`
        }}>
          {syncResult.type === "success" ? (
            <div>
              <strong>Supplier Feed Synchronized:</strong> Created {syncResult.data.created} new parts, Updated {syncResult.data.updated}, Unchanged {syncResult.data.unchanged}, Rejected {syncResult.data.rejected?.length || 0}. ({syncResult.data.requests_made} HTTP requests made across {syncResult.data.pages_fetched} pages).
            </div>
          ) : (
            <div><strong>Supplier Sync Failed:</strong> {syncResult.message}</div>
          )}
        </div>
      )}

      {/* Stats Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        <div className="card">
          <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Forecasted Products</span>
          <div style={{ fontSize: "1.8rem", fontWeight: "800", marginTop: "0.3rem" }}>40 SKUs</div>
        </div>
        <div className="card">
          <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Items Requiring Reorder</span>
          <div style={{ fontSize: "1.8rem", fontWeight: "800", marginTop: "0.3rem", color: urgentCount > 0 ? "var(--warning)" : "var(--success)" }}>
            {urgentCount} SKUs
          </div>
        </div>
        <div className="card">
          <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Forecast Horizon</span>
          <div style={{ fontSize: "1.1rem", fontWeight: "700", marginTop: "0.5rem", color: "var(--accent-primary)" }}>
            4 Weeks (Sep 28 - Oct 19, 2026)
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div style={{ display: "grid", gridTemplateColumns: selectedSku ? "1fr 340px" : "1fr", gap: "1.5rem" }}>
        {/* Reorders Table */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid var(--border-color)", fontWeight: "700" }}>
            Reorder Formula Breakdown (40 Target SKUs)
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "3rem" }}>Loading reorder suggestions...</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
                <thead>
                  <tr style={{ background: "rgba(255, 255, 255, 0.02)", borderBottom: "1px solid var(--border-color)", textAlign: "left", color: "var(--text-secondary)" }}>
                    <th style={{ padding: "0.75rem 1rem" }}>SKU</th>
                    <th style={{ padding: "0.75rem 0.5rem" }}>Live Stock</th>
                    <th style={{ padding: "0.75rem 0.5rem" }}>Lead Time</th>
                    <th style={{ padding: "0.75rem 0.5rem" }}>Lead Time Demand</th>
                    <th style={{ padding: "0.75rem 0.5rem" }}>Safety Stock</th>
                    <th style={{ padding: "0.75rem 0.5rem" }}>Reorder Point</th>
                    <th style={{ padding: "0.75rem 0.5rem" }}>Suggested Reorder</th>
                    <th style={{ padding: "0.75rem 1rem", textAlign: "right" }}>Forecast</th>
                  </tr>
                </thead>
                <tbody>
                  {reorders.map((r) => {
                    const needsReorder = r.reorder_qty > 0;
                    return (
                      <tr
                        key={r.sku}
                        style={{
                          borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
                          background: selectedSku === r.sku ? "rgba(59, 130, 246, 0.1)" : "transparent"
                        }}
                      >
                        <td style={{ padding: "0.75rem 1rem", fontFamily: "var(--font-mono)", fontWeight: "700", color: "var(--accent-primary)" }}>
                          {r.sku}
                        </td>
                        <td style={{ padding: "0.75rem 0.5rem", fontWeight: "600" }}>{r.current_stock}</td>
                        <td style={{ padding: "0.75rem 0.5rem" }}>{r.lead_time_weeks} wk</td>
                        <td style={{ padding: "0.75rem 0.5rem" }}>{r.lead_time_demand}</td>
                        <td style={{ padding: "0.75rem 0.5rem" }}>{r.safety_stock}</td>
                        <td style={{ padding: "0.75rem 0.5rem", fontWeight: "600" }}>{r.reorder_point}</td>
                        <td style={{ padding: "0.75rem 0.5rem" }}>
                          <span className={`badge ${needsReorder ? "badge-draft" : "badge-confirmed"}`}>
                            {needsReorder ? `Order ${r.reorder_qty}` : "Optimal (0)"}
                          </span>
                        </td>
                        <td style={{ padding: "0.75rem 1rem", textAlign: "right" }}>
                          <button
                            onClick={() => handleInspectForecast(r.sku)}
                            className="btn-secondary"
                            style={{ padding: "0.25rem 0.6rem", fontSize: "0.75rem" }}
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
          <div className="card" style={{ height: "fit-content" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ fontSize: "1.05rem", fontWeight: "700" }}>
                Forecast: <span style={{ color: "var(--accent-primary)", fontFamily: "var(--font-mono)" }}>{selectedSku}</span>
              </h3>
              <button onClick={() => setSelectedSku(null)} style={{ color: "var(--text-muted)" }}>✕</button>
            </div>

            {forecastLoading ? (
              <div style={{ textAlign: "center", padding: "2rem" }}>Loading weekly predictions...</div>
            ) : skuForecast ? (
              <div>
                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "block", marginBottom: "0.8rem" }}>
                  Committed 4-Week Future Predictions (ml/forecast.csv)
                </span>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  {skuForecast.map((f, i) => (
                    <div
                      key={f.week_start}
                      style={{
                        padding: "0.75rem", borderRadius: "8px", background: "var(--bg-tertiary)",
                        display: "flex", justifyContent: "space-between", alignItems: "center"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem" }}>
                        <Calendar size={14} color="var(--accent-primary)" />
                        <span>Week {i + 1} ({f.week_start})</span>
                      </div>
                      <strong style={{ fontSize: "1rem", color: "var(--text-primary)" }}>
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
