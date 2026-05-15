"use client";
import { useState, useCallback, useEffect } from "react";
import {
  fetchAccounts, fetchAccountInsights, fetchCampaigns, fetchMonthlyInsights,
  fetchAdInsights, fetchDailyInsights, fetchFunnelData, fetchPlacementBreakdown,
  fetchAgeGenderBreakdown, fetchDeviceBreakdown, fetchCampaignAdsets,
  extractPurchases, extractROAS, extractRevenue, extractActionValue,
  fmt, fmtCurrency, fmtFull, getDateRange, getPreviousPeriod
} from "../lib/meta-api";

const T = {
  bg: "#0B0E14", card: "#12161F", cardHover: "#181D28", border: "#1E2433",
  accent: "#3B82F6", accentSoft: "rgba(59,130,246,0.12)",
  green: "#10B981", greenSoft: "rgba(16,185,129,0.12)",
  red: "#EF4444", redSoft: "rgba(239,68,68,0.12)",
  amber: "#F59E0B", amberSoft: "rgba(245,158,11,0.12)",
  purple: "#8B5CF6", purpleSoft: "rgba(139,92,246,0.12)",
  text: "#E2E8F0", textMuted: "#94A3B8", textDim: "#64748B",
};

const DATE_PRESETS = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "7d", label: "Last 7 Days" },
  { id: "14d", label: "Last 14 Days" },
  { id: "30d", label: "Last 30 Days" },
  { id: "90d", label: "Last 90 Days" },
  { id: "this_month", label: "This Month" },
  { id: "last_month", label: "Last Month" },
  { id: "custom", label: "Custom Range" },
];

// ─── Components ───

function DatePicker({ preset, onPresetChange, customFrom, customTo, onCustomChange }) {
  const [open, setOpen] = useState(false);
  const current = DATE_PRESETS.find(d => d.id === preset);
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(!open)}
        style={{ padding: "8px 16px", background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
        📅 {current?.label || "Last 30 Days"} <span style={{ color: T.textDim }}>▾</span>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 4, background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 6, zIndex: 100, minWidth: 200, boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>
          {DATE_PRESETS.map(d => (
            <button key={d.id} onClick={() => { onPresetChange(d.id); if (d.id !== "custom") setOpen(false); }}
              style={{ display: "block", width: "100%", padding: "8px 12px", background: preset === d.id ? T.accentSoft : "transparent", border: "none", borderRadius: 6, color: preset === d.id ? T.accent : T.text, fontSize: 12, cursor: "pointer", textAlign: "left", marginBottom: 2 }}>
              {d.label}
            </button>
          ))}
          {preset === "custom" && (
            <div style={{ padding: "8px 12px", borderTop: `1px solid ${T.border}`, marginTop: 4 }}>
              <label style={{ color: T.textDim, fontSize: 10, display: "block", marginBottom: 4 }}>From</label>
              <input type="date" value={customFrom} onChange={e => onCustomChange("from", e.target.value)}
                style={{ width: "100%", padding: "6px 8px", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6, color: T.text, fontSize: 11, marginBottom: 8 }} />
              <label style={{ color: T.textDim, fontSize: 10, display: "block", marginBottom: 4 }}>To</label>
              <input type="date" value={customTo} onChange={e => onCustomChange("to", e.target.value)}
                style={{ width: "100%", padding: "6px 8px", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6, color: T.text, fontSize: 11, marginBottom: 8 }} />
              <button onClick={() => setOpen(false)}
                style={{ width: "100%", padding: "8px 0", background: T.accent, border: "none", borderRadius: 6, color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Apply</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, prev, color = T.text, prefix = "" }) {
  const change = prev && prev > 0 ? ((parseFloat(value) - prev) / prev) * 100 : null;
  return (
    <div style={{ background: T.card, borderRadius: 12, padding: "16px 18px", border: `1px solid ${T.border}` }}>
      <p style={{ color: T.textDim, fontSize: 10, margin: 0, textTransform: "uppercase", letterSpacing: 1 }}>{label}</p>
      <p style={{ color, fontSize: 22, fontWeight: 700, margin: "6px 0 0" }}>{prefix}{typeof value === "number" ? (value >= 1000 ? fmt(value) : value.toFixed(2)) : value}</p>
      {change !== null && (
        <span style={{ display: "inline-block", marginTop: 4, padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600, background: change >= 0 ? T.greenSoft : T.redSoft, color: change >= 0 ? T.green : T.red }}>
          {change >= 0 ? "↑" : "↓"} {Math.abs(change).toFixed(1)}% vs prev
        </span>
      )}
    </div>
  );
}

function HealthBadge({ score }) {
  let label, color, bg;
  if (score >= 70) { label = "Healthy"; color = T.green; bg = T.greenSoft; }
  else if (score >= 40) { label = "Warning"; color = T.amber; bg = T.amberSoft; }
  else { label = "Critical"; color = T.red; bg = T.redSoft; }
  return <span style={{ padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: bg, color }}>{label} ({score})</span>;
}

function FunnelViz({ data }) {
  if (!data) return null;
  const steps = [
    { label: "Impressions", value: data.impressions, color: T.accent },
    { label: "Link Clicks", value: data.link_clicks, color: "#6366F1" },
    { label: "LPV", value: data.landing_page_views, color: T.purple },
    { label: "Add to Cart", value: data.add_to_cart, color: T.amber },
    { label: "Checkout", value: data.initiate_checkout, color: "#F97316" },
    { label: "Purchase", value: data.purchases, color: T.green },
  ].filter(s => s.value > 0);

  const maxVal = steps[0]?.value || 1;
  return (
    <div style={{ background: T.card, borderRadius: 12, padding: 20, border: `1px solid ${T.border}` }}>
      <p style={{ color: T.textMuted, fontSize: 12, fontWeight: 600, margin: "0 0 16px" }}>Purchase Funnel</p>
      {steps.map((s, i) => {
        const width = Math.max((s.value / maxVal) * 100, 8);
        const dropoff = i > 0 ? (((steps[i - 1].value - s.value) / steps[i - 1].value) * 100).toFixed(0) : null;
        return (
          <div key={s.label} style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <span style={{ color: T.textMuted, fontSize: 11 }}>{s.label}</span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {dropoff && <span style={{ color: T.red, fontSize: 10 }}>-{dropoff}%</span>}
                <span style={{ color: T.text, fontSize: 12, fontWeight: 600 }}>{fmtFull(s.value)}</span>
              </div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 4, height: 24, overflow: "hidden" }}>
              <div style={{ width: `${width}%`, height: "100%", background: `linear-gradient(90deg, ${s.color}, ${s.color}88)`, borderRadius: 4, transition: "width 0.6s ease", display: "flex", alignItems: "center", paddingLeft: 8 }}>
                {width > 15 && <span style={{ color: "#fff", fontSize: 10, fontWeight: 500 }}>{fmtFull(s.value)}</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DailyChart({ data }) {
  if (!data || data.length === 0) return null;
  const maxSpend = Math.max(...data.map(d => parseFloat(d.spend || 0)));
  const chartH = 160;
  return (
    <div style={{ background: T.card, borderRadius: 12, padding: 20, border: `1px solid ${T.border}` }}>
      <p style={{ color: T.textMuted, fontSize: 12, fontWeight: 600, margin: "0 0 16px" }}>Daily Spend & ROAS</p>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: chartH }}>
        {data.map((d, i) => {
          const spend = parseFloat(d.spend || 0);
          const roas = extractROAS(d.purchase_roas);
          const h = maxSpend > 0 ? (spend / maxSpend) * chartH : 0;
          const barColor = roas >= 4 ? T.green : roas >= 3 ? T.amber : roas > 0 ? T.red : T.accent;
          return (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }} title={`${d.date_start?.slice(5)}\nSpend: ${fmtCurrency(spend)}\nROAS: ${roas.toFixed(2)}x\nPurchases: ${extractPurchases(d.actions)}`}>
              <div style={{ width: "100%", maxWidth: 20, height: h, background: barColor, borderRadius: "3px 3px 0 0", opacity: 0.8, transition: "height 0.4s ease", cursor: "pointer" }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
        <span style={{ color: T.textDim, fontSize: 9 }}>{data[0]?.date_start?.slice(5)}</span>
        <span style={{ color: T.textDim, fontSize: 9 }}>{data[data.length - 1]?.date_start?.slice(5)}</span>
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: T.textDim }}><span style={{ width: 8, height: 8, borderRadius: 2, background: T.green }} /> ROAS 4x+</span>
        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: T.textDim }}><span style={{ width: 8, height: 8, borderRadius: 2, background: T.amber }} /> ROAS 3-4x</span>
        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: T.textDim }}><span style={{ width: 8, height: 8, borderRadius: 2, background: T.red }} /> ROAS &lt;3x</span>
      </div>
    </div>
  );
}

function CampaignRow({ c, token, dateRange, expanded, onToggle }) {
  const [adsets, setAdsets] = useState(null);
  const ins = c.insights;
  if (!ins) return null;

  const spend = parseFloat(ins.spend || 0);
  const purchases = extractPurchases(ins.actions);
  const roas = extractROAS(ins.purchase_roas);
  const revenue = extractRevenue(ins.action_values);
  const freq = parseFloat(ins.frequency || 0);
  const ctr = parseFloat(ins.ctr || 0);
  const cpm = parseFloat(ins.cpm || 0);
  const cpp = purchases > 0 ? spend / purchases : 0;

  let health = "Scale", hColor = T.green;
  if (freq > 3.5 || roas < 2) { health = "Kill"; hColor = T.red; }
  else if (freq > 2.5 || roas < 3 || ctr < 1.5) { health = "Monitor"; hColor = T.amber; }
  else if (roas >= 4 && ctr >= 2) { health = "Scale"; hColor = T.green; }
  else { health = "Maintain"; hColor = T.accent; }

  const totalSpend = 1; // placeholder

  const loadAdsets = async () => {
    if (adsets) { onToggle(); return; }
    try {
      const data = await fetchCampaignAdsets(c.id, token, dateRange);
      setAdsets(data);
      onToggle();
    } catch { onToggle(); }
  };

  return (
    <div style={{ marginBottom: 6 }}>
      <div onClick={loadAdsets}
        style={{ background: T.card, borderRadius: 10, border: `1px solid ${T.border}`, borderLeft: `4px solid ${hColor}`, padding: "14px 18px", cursor: "pointer", transition: "background 0.15s" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: T.textDim, fontSize: 12 }}>{expanded ? "▼" : "▶"}</span>
            <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: T.text }}>{c.name}</p>
            <span style={{ padding: "2px 6px", borderRadius: 4, fontSize: 9, fontWeight: 600, background: c.status === "ACTIVE" ? T.greenSoft : T.amberSoft, color: c.status === "ACTIVE" ? T.green : T.amber }}>{c.status}</span>
          </div>
          <span style={{ padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: hColor === T.green ? T.greenSoft : hColor === T.amber ? T.amberSoft : hColor === T.red ? T.redSoft : T.accentSoft, color: hColor }}>{health}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 8 }}>
          {[
            { l: "Spend", v: fmtCurrency(spend) },
            { l: "Revenue", v: fmtCurrency(revenue) },
            { l: "Purchases", v: purchases },
            { l: "ROAS", v: `${roas.toFixed(2)}x`, c: roas >= 4 ? T.green : roas >= 3 ? T.amber : T.red },
            { l: "CPA", v: fmtCurrency(cpp), c: cpp > 1500 ? T.red : cpp > 1000 ? T.amber : T.green },
            { l: "CTR", v: `${ctr}%`, c: ctr < 1.5 ? T.red : T.text },
            { l: "Freq", v: freq.toFixed(2), c: freq > 3 ? T.red : freq > 2.5 ? T.amber : T.text },
            { l: "CPM", v: fmtCurrency(cpm) },
          ].map(m => (
            <div key={m.l}>
              <p style={{ color: T.textDim, fontSize: 9, margin: "0 0 2px", textTransform: "uppercase" }}>{m.l}</p>
              <p style={{ color: m.c || T.text, fontSize: 13, fontWeight: 600, margin: 0 }}>{m.v}</p>
            </div>
          ))}
        </div>
      </div>

      {expanded && adsets && (
        <div style={{ marginLeft: 24, marginTop: 4 }}>
          {adsets.filter(as => as.insights).map(as => {
            const aSpend = parseFloat(as.insights.spend || 0);
            const aPurchases = extractPurchases(as.insights.actions);
            const aRoas = extractROAS(as.insights.purchase_roas);
            const aFreq = parseFloat(as.insights.frequency || 0);
            const aCtr = parseFloat(as.insights.ctr || 0);
            return (
              <div key={as.id} style={{ background: T.cardHover, borderRadius: 8, padding: "10px 14px", marginBottom: 4, borderLeft: `3px solid ${T.accent}44` }}>
                <p style={{ fontSize: 11, fontWeight: 500, margin: "0 0 6px", color: T.textMuted }}>{as.name}</p>
                <div style={{ display: "flex", gap: 20, fontSize: 11 }}>
                  <span style={{ color: T.textDim }}>Spend: <b style={{ color: T.text }}>{fmtCurrency(aSpend)}</b></span>
                  <span style={{ color: T.textDim }}>Purchases: <b style={{ color: T.text }}>{aPurchases}</b></span>
                  <span style={{ color: T.textDim }}>ROAS: <b style={{ color: aRoas >= 4 ? T.green : aRoas >= 3 ? T.amber : T.red }}>{aRoas.toFixed(2)}x</b></span>
                  <span style={{ color: T.textDim }}>Freq: <b style={{ color: aFreq > 3 ? T.red : T.text }}>{aFreq.toFixed(2)}</b></span>
                  <span style={{ color: T.textDim }}>CTR: <b style={{ color: aCtr < 1.5 ? T.red : T.text }}>{aCtr}%</b></span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AdRow({ ad }) {
  const spend = parseFloat(ad.spend || 0);
  const purchases = extractPurchases(ad.actions);
  const roas = extractROAS(ad.purchase_roas);
  const freq = parseFloat(ad.frequency || 0);
  const ctr = parseFloat(ad.ctr || 0);
  const engagements = extractActionValue(ad.actions, "page_engagement");
  const engRatio = purchases > 0 ? Math.round(engagements / purchases) : engagements > 0 ? "∞" : 0;
  const cpp = purchases > 0 ? spend / purchases : 0;

  let status = "Healthy", sColor = T.green, sBg = T.greenSoft;
  if (freq > 3.5 || (ctr < 1.0 && spend > 1000) || roas < 2) { status = "Dead"; sColor = T.red; sBg = T.redSoft; }
  else if (freq > 2.5 || ctr < 1.5 || roas < 3) { status = "Fatiguing"; sColor = T.amber; sBg = T.amberSoft; }
  else if (roas >= 5 && spend > 500) { status = "Scale ↑"; sColor = T.green; sBg = T.greenSoft; }

  return (
    <div style={{ display: "flex", alignItems: "center", padding: "12px 16px", background: T.card, borderRadius: 10, border: `1px solid ${T.border}`, marginBottom: 6, borderLeft: `3px solid ${sColor}`, gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ color: T.text, fontSize: 12, fontWeight: 500, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ad.ad_name}</p>
        <p style={{ color: T.textDim, fontSize: 10, margin: "2px 0 0" }}>{ad.campaign_name}</p>
      </div>
      <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ color: T.textDim, fontSize: 9, margin: 0 }}>SPEND</p>
          <p style={{ color: T.text, fontSize: 11, fontWeight: 600, margin: 0 }}>{fmtCurrency(spend)}</p>
        </div>
        <div style={{ textAlign: "center" }}>
          <p style={{ color: T.textDim, fontSize: 9, margin: 0 }}>PURCH</p>
          <p style={{ color: T.text, fontSize: 11, fontWeight: 600, margin: 0 }}>{purchases}</p>
        </div>
        <div style={{ textAlign: "center" }}>
          <p style={{ color: T.textDim, fontSize: 9, margin: 0 }}>ROAS</p>
          <p style={{ color: roas >= 4 ? T.green : roas >= 3 ? T.amber : T.red, fontSize: 11, fontWeight: 700, margin: 0 }}>{roas.toFixed(2)}x</p>
        </div>
        <div style={{ textAlign: "center" }}>
          <p style={{ color: T.textDim, fontSize: 9, margin: 0 }}>CPA</p>
          <p style={{ color: T.text, fontSize: 11, fontWeight: 600, margin: 0 }}>{purchases > 0 ? fmtCurrency(cpp) : "—"}</p>
        </div>
        <div style={{ textAlign: "center" }}>
          <p style={{ color: T.textDim, fontSize: 9, margin: 0 }}>FREQ</p>
          <p style={{ color: freq > 3 ? T.red : freq > 2.5 ? T.amber : T.text, fontSize: 11, fontWeight: 600, margin: 0 }}>{freq.toFixed(2)}</p>
        </div>
        <div style={{ textAlign: "center" }}>
          <p style={{ color: T.textDim, fontSize: 9, margin: 0 }}>CTR</p>
          <p style={{ color: ctr < 1.5 ? T.red : T.text, fontSize: 11, fontWeight: 600, margin: 0 }}>{ctr}%</p>
        </div>
        <div style={{ textAlign: "center" }}>
          <p style={{ color: T.textDim, fontSize: 9, margin: 0 }}>ENG:BUY</p>
          <p style={{ color: typeof engRatio === "number" && engRatio > 300 ? T.red : T.textMuted, fontSize: 11, fontWeight: 600, margin: 0 }}>{engRatio}:1</p>
        </div>
      </div>
      <span style={{ padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: sBg, color: sColor, whiteSpace: "nowrap" }}>{status}</span>
    </div>
  );
}

function MonthlyChart({ data }) {
  if (!data || data.length === 0) return null;
  const maxSpend = Math.max(...data.map(d => parseFloat(d.data?.spend || 0)));
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${data.length}, 1fr)`, gap: 10 }}>
      {data.map((m, i) => {
        const spend = parseFloat(m.data?.spend || 0);
        const purchases = extractPurchases(m.data?.actions);
        const roas = extractROAS(m.data?.purchase_roas);
        const revenue = extractRevenue(m.data?.action_values);
        const freq = parseFloat(m.data?.frequency || 0);
        const ctr = parseFloat(m.data?.ctr || 0);
        const barH = maxSpend > 0 ? (spend / maxSpend) * 120 : 0;
        const prevRoas = i > 0 ? extractROAS(data[i - 1].data?.purchase_roas) : null;
        const roasChange = prevRoas && prevRoas > 0 ? ((roas - prevRoas) / prevRoas) * 100 : null;
        return (
          <div key={m.label} style={{ background: T.card, borderRadius: 10, padding: "14px 12px", border: `1px solid ${T.border}`, textAlign: "center" }}>
            <p style={{ color: T.textMuted, fontSize: 12, fontWeight: 600, margin: "0 0 12px" }}>{m.label}</p>
            <div style={{ height: 120, display: "flex", alignItems: "flex-end", justifyContent: "center", marginBottom: 10 }}>
              <div style={{ width: 32, height: barH, background: `linear-gradient(to top, ${T.accent}, rgba(59,130,246,0.4))`, borderRadius: "6px 6px 0 0", transition: "height 0.6s ease" }} />
            </div>
            <p style={{ color: T.text, fontSize: 14, fontWeight: 700, margin: "0 0 2px" }}>{fmtCurrency(spend)}</p>
            <p style={{ color: T.textDim, fontSize: 10, margin: "0 0 8px" }}>spend</p>
            <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 8, textAlign: "left" }}>
              {[
                { l: "Revenue", v: fmtCurrency(revenue), c: T.text },
                { l: "ROAS", v: `${roas.toFixed(2)}x`, c: roas >= 4 ? T.green : roas >= 3 ? T.amber : T.red, extra: roasChange !== null ? `${roasChange >= 0 ? "↑" : "↓"}${Math.abs(roasChange).toFixed(0)}%` : "" },
                { l: "Purchases", v: purchases, c: T.text },
                { l: "CTR", v: `${ctr.toFixed(2)}%`, c: ctr < 1.5 ? T.red : T.text },
                { l: "Freq", v: freq.toFixed(2), c: freq > 3 ? T.red : freq > 2.5 ? T.amber : T.text },
              ].map(r => (
                <div key={r.l} style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ color: T.textDim, fontSize: 10 }}>{r.l}</span>
                  <span style={{ color: r.c, fontSize: 11, fontWeight: 600 }}>{r.v} {r.extra && <span style={{ fontSize: 9, color: r.extra.includes("↑") ? T.green : T.red }}>{r.extra}</span>}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PlacementTable({ data }) {
  if (!data || data.length === 0) return <p style={{ color: T.textDim, fontSize: 12, textAlign: "center", padding: 20 }}>No placement data</p>;
  return (
    <div style={{ background: T.card, borderRadius: 12, border: `1px solid ${T.border}`, overflow: "auto" }}>
      <p style={{ color: T.textMuted, fontSize: 12, fontWeight: 600, padding: "14px 18px 0", margin: 0 }}>Placement Performance</p>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${T.border}` }}>
            {["Platform", "Position", "Spend", "Purch", "ROAS", "CTR", "CPM"].map(h =>
              <th key={h} style={{ padding: "10px 12px", textAlign: h === "Platform" || h === "Position" ? "left" : "center", color: T.textDim, fontWeight: 500, fontSize: 10, textTransform: "uppercase" }}>{h}</th>
            )}
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 10).map((p, i) => {
            const pRoas = extractROAS(p.purchase_roas);
            return (
              <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}>
                <td style={{ padding: "10px 12px", fontWeight: 500 }}>{p.publisher_platform}</td>
                <td style={{ padding: "10px 12px", color: T.textMuted }}>{p.platform_position}</td>
                <td style={{ textAlign: "center" }}>{fmtCurrency(parseFloat(p.spend || 0))}</td>
                <td style={{ textAlign: "center", fontWeight: 600 }}>{extractPurchases(p.actions)}</td>
                <td style={{ textAlign: "center", fontWeight: 700, color: pRoas >= 4 ? T.green : pRoas >= 3 ? T.amber : T.red }}>{pRoas.toFixed(2)}x</td>
                <td style={{ textAlign: "center" }}>{p.ctr}%</td>
                <td style={{ textAlign: "center" }}>{fmtCurrency(parseFloat(p.cpm || 0))}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Dashboard ───
export default function Home() {
  const [token, setToken] = useState(process.env.NEXT_PUBLIC_TOKEN || "");
  const [connected, setConnected] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [selectedAcc, setSelectedAcc] = useState(null);
  const [insights, setInsights] = useState(null);
  const [prevInsights, setPrevInsights] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [adData, setAdData] = useState([]);
  const [dailyData, setDailyData] = useState([]);
  const [funnelData, setFunnelData] = useState(null);
  const [placementData, setPlacementData] = useState([]);
  const [ageGenderData, setAgeGenderData] = useState([]);
  const [deviceData, setDeviceData] = useState([]);
  const [shopifyData, setShopifyData] = useState(null);
  const [shopifyLoading, setShopifyLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("overview");
  const [search, setSearch] = useState("");
  const [datePreset, setDatePreset] = useState("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [expandedCampaigns, setExpandedCampaigns] = useState({});

  const dateRange = getDateRange(datePreset, customFrom, customTo);
  const prevRange = getPreviousPeriod(dateRange);

  const connect = useCallback(async () => {
    if (!token || token.length < 20) return;
    setLoading(true); setError(null);
    try {
      const accs = await fetchAccounts(token);
      setAccounts(accs); setConnected(true);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, [token]);

  const loadAccount = useCallback(async (acc) => {
    setLoading(true); setSelectedAcc(acc); setTab("overview"); setExpandedCampaigns({});
    try {
      const [ins, prevIns, camps, monthly, ads, daily, funnel, placements, ageGender, devices] = await Promise.all([
        fetchAccountInsights(acc.id, token, dateRange),
        fetchAccountInsights(acc.id, token, prevRange),
        fetchCampaigns(acc.id, token, dateRange),
        fetchMonthlyInsights(acc.id, token, 4),
        fetchAdInsights(acc.id, token, dateRange),
        fetchDailyInsights(acc.id, token, dateRange),
        fetchFunnelData(acc.id, token, dateRange),
        fetchPlacementBreakdown(acc.id, token, dateRange),
        fetchAgeGenderBreakdown(acc.id, token, dateRange),
        fetchDeviceBreakdown(acc.id, token, dateRange),
      ]);
      setInsights(ins); setPrevInsights(prevIns); setCampaigns(camps);
      setMonthlyData(monthly); setAdData(ads); setDailyData(daily);
      setFunnelData(funnel); setPlacementData(placements);
      setAgeGenderData(ageGender); setDeviceData(devices);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, [token, dateRange, prevRange]);

  useEffect(() => {
    if (selectedAcc && connected) loadAccount(selectedAcc);
  }, [datePreset, customFrom, customTo]);

  const loadShopifyData = useCallback(async () => {
    setShopifyLoading(true);
    try {
      const [ordersRes, productsRes, countRes, custRes] = await Promise.all([
        fetch(`/api/shopify?endpoint=orders&params=created_at_min=${dateRange.since}T00:00:00Z%26created_at_max=${dateRange.until}T23:59:59Z%26status=any%26limit=250`),
        fetch(`/api/shopify?endpoint=products&params=limit=50`),
        fetch(`/api/shopify?endpoint=orders_count&params=created_at_min=${dateRange.since}T00:00:00Z%26created_at_max=${dateRange.until}T23:59:59Z%26status=any`),
        fetch(`/api/shopify?endpoint=customers_count`),
      ]);
      const orders = await ordersRes.json();
      const products = await productsRes.json();
      const count = await countRes.json();
      const customers = await custRes.json();

      if (orders.error) { setShopifyData({ error: orders.error }); setShopifyLoading(false); return; }

      const ordersList = orders.orders || [];
      const totalRevenue = ordersList.reduce((s, o) => s + parseFloat(o.total_price || 0), 0);
      const totalOrders = ordersList.length;
      const aov = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      const fulfilled = ordersList.filter(o => o.fulfillment_status === "fulfilled").length;
      const cancelled = ordersList.filter(o => o.cancelled_at).length;
      const refunded = ordersList.filter(o => o.financial_status === "refunded").length;

      const productSales = {};
      ordersList.forEach(o => {
        (o.line_items || []).forEach(item => {
          if (!productSales[item.title]) productSales[item.title] = { title: item.title, qty: 0, revenue: 0 };
          productSales[item.title].qty += item.quantity;
          productSales[item.title].revenue += parseFloat(item.price) * item.quantity;
        });
      });
      const topProducts = Object.values(productSales).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

      const dailyOrders = {};
      ordersList.forEach(o => {
        const day = o.created_at?.split("T")[0];
        if (!dailyOrders[day]) dailyOrders[day] = { date: day, orders: 0, revenue: 0 };
        dailyOrders[day].orders++;
        dailyOrders[day].revenue += parseFloat(o.total_price || 0);
      });
      const dailySales = Object.values(dailyOrders).sort((a, b) => a.date.localeCompare(b.date));

      const metaSpend = parseFloat(insights?.spend || 0);
      const trueRoas = metaSpend > 0 ? totalRevenue / metaSpend : 0;

      setShopifyData({
        totalRevenue, totalOrders, aov, fulfilled, cancelled, refunded,
        orderCount: count.count || totalOrders,
        customerCount: customers.count || 0,
        topProducts, dailySales, trueRoas,
        productCount: products.products?.length || 0,
      });
    } catch (e) { setShopifyData({ error: e.message }); }
    setShopifyLoading(false);
  }, [dateRange, insights]);

  const filteredAccounts = accounts.filter(a =>
    (a.name || a.id).toLowerCase().includes(search.toLowerCase())
  );

  const calcHealthScore = (ins) => {
    if (!ins) return 0;
    const roas = extractROAS(ins.purchase_roas);
    const freq = parseFloat(ins.frequency || 0);
    const ctr = parseFloat(ins.ctr || 0);
    let score = 50;
    if (roas >= 5) score += 25; else if (roas >= 4) score += 20; else if (roas >= 3) score += 10; else if (roas < 2) score -= 20; else score -= 10;
    if (freq < 2) score += 10; else if (freq < 3) score += 5; else if (freq > 3.5) score -= 15; else score -= 5;
    if (ctr >= 2.5) score += 15; else if (ctr >= 1.5) score += 5; else score -= 10;
    return Math.max(0, Math.min(100, score));
  };

  // ─── Login ───
  if (!connected) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: T.bg }}>
        <div style={{ textAlign: "center", maxWidth: 460, padding: 24 }}>
          <div style={{ fontSize: 44, marginBottom: 8 }}>📊</div>
          <h1 style={{ color: T.text, fontSize: 24, fontWeight: 700, margin: "0 0 4px" }}>ADVI MEDIA</h1>
          <p style={{ color: T.textDim, fontSize: 13, margin: "0 0 36px" }}>Agency Performance Dashboard</p>
          <input type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="Paste Meta API Token..."
            onKeyDown={e => e.key === "Enter" && connect()}
            style={{ width: "100%", padding: "14px 16px", background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, color: T.text, fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 14, fontFamily: "'JetBrains Mono', monospace" }} />
          <button onClick={connect} style={{ width: "100%", padding: "13px 0", background: T.accent, border: "none", borderRadius: 10, color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            {loading ? "Connecting..." : "Connect & Load →"}
          </button>
          {error && <p style={{ color: T.red, fontSize: 12, marginTop: 12 }}>{error}</p>}
          <p style={{ color: T.textDim, fontSize: 11, marginTop: 14 }}>Token sirf browser session mein rehta hai</p>
        </div>
      </div>
    );
  }

  const spend = parseFloat(insights?.spend || 0);
  const purchases = extractPurchases(insights?.actions);
  const roas = extractROAS(insights?.purchase_roas);
  const revenue = extractRevenue(insights?.action_values);
  const freq = parseFloat(insights?.frequency || 0);
  const ctr = parseFloat(insights?.ctr || 0);
  const cpm = parseFloat(insights?.cpm || 0);
  const cpc = parseFloat(insights?.cpc || 0);
  const reach = parseInt(insights?.reach || 0);
  const cpp = purchases > 0 ? spend / purchases : 0;
  const aov = purchases > 0 ? revenue / purchases : 0;

  const pSpend = parseFloat(prevInsights?.spend || 0);
  const pPurchases = extractPurchases(prevInsights?.actions);
  const pRoas = extractROAS(prevInsights?.purchase_roas);
  const pRevenue = extractRevenue(prevInsights?.action_values);
  const pFreq = parseFloat(prevInsights?.frequency || 0);
  const pCtr = parseFloat(prevInsights?.ctr || 0);
  const pCpm = parseFloat(prevInsights?.cpm || 0);
  const pCpc = parseFloat(prevInsights?.cpc || 0);
  const pCpp = pPurchases > 0 ? pSpend / pPurchases : 0;
  const pAov = pPurchases > 0 ? pRevenue / pPurchases : 0;

  const healthScore = calcHealthScore(insights);

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "campaigns", label: "Campaigns" },
    { id: "ads", label: "Ads" },
    { id: "audience", label: "Audience" },
    { id: "placements", label: "Placements" },
    { id: "shopify", label: "🛍 Shopify" },
    { id: "alerts", label: "⚠ Alerts" },
    { id: "monthly", label: "Monthly" },
  ];

  const topAds = [...adData].filter(a => parseFloat(a.spend || 0) > 100).sort((a, b) => extractROAS(b.purchase_roas) - extractROAS(a.purchase_roas)).slice(0, 5);
  const worstAds = [...adData].filter(a => parseFloat(a.spend || 0) > 500).sort((a, b) => extractROAS(a.purchase_roas) - extractROAS(b.purchase_roas)).slice(0, 5);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: T.bg, fontFamily: "'DM Sans', -apple-system, sans-serif", color: T.text }}>
      {/* Sidebar */}
      <div style={{ width: 260, borderRight: `1px solid ${T.border}`, padding: "20px 12px", overflowY: "auto", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 8px", marginBottom: 20 }}>
          <span style={{ fontSize: 22 }}>📊</span>
          <div>
            <p style={{ color: T.text, fontSize: 15, fontWeight: 700, margin: 0 }}>ADVI MEDIA</p>
            <p style={{ color: T.textDim, fontSize: 10, margin: 0 }}>Agency Dashboard</p>
          </div>
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search client..."
          style={{ width: "100%", padding: "10px 12px", background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 12, outline: "none", boxSizing: "border-box", marginBottom: 12 }} />
        <p style={{ color: T.textDim, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, padding: "0 8px", marginBottom: 8 }}>Accounts ({filteredAccounts.length})</p>
        {filteredAccounts.map(acc => (
          <div key={acc.id} onClick={() => loadAccount(acc)}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: selectedAcc?.id === acc.id ? T.accentSoft : "transparent", borderRadius: 8, cursor: "pointer", borderLeft: selectedAcc?.id === acc.id ? `3px solid ${T.accent}` : "3px solid transparent", marginBottom: 2 }}>
            <p style={{ color: T.text, fontSize: 12, fontWeight: selectedAcc?.id === acc.id ? 600 : 400, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{acc.name?.replace("act_", "")}</p>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: acc.account_status === 1 ? T.green : T.red, flexShrink: 0 }} />
          </div>
        ))}
        <button onClick={() => { setConnected(false); setToken(""); setAccounts([]); setSelectedAcc(null); }}
          style={{ width: "100%", marginTop: 20, padding: "10px 0", background: T.redSoft, border: `1px solid rgba(239,68,68,0.2)`, borderRadius: 8, color: T.red, fontSize: 11, cursor: "pointer" }}>Disconnect</button>
      </div>

      {/* Main */}
      <div style={{ flex: 1, padding: "20px 28px", overflowY: "auto" }}>
        {loading && (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <div style={{ width: 36, height: 36, border: `3px solid ${T.border}`, borderTopColor: T.accent, borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
            <p style={{ color: T.textMuted, fontSize: 13 }}>Loading data...</p>
          </div>
        )}

        {!loading && !selectedAcc && (
          <div style={{ textAlign: "center", padding: "100px 0" }}>
            <p style={{ fontSize: 48, margin: "0 0 12px" }}>←</p>
            <p style={{ color: T.textMuted, fontSize: 15 }}>Select a client from sidebar</p>
          </div>
        )}

        {!loading && selectedAcc && insights && (
          <>
            {/* Header */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div>
                    <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{selectedAcc.name}</h1>
                    <p style={{ color: T.textDim, fontSize: 11, margin: "2px 0 0" }}>{dateRange.since} — {dateRange.until}</p>
                  </div>
                  <HealthBadge score={healthScore} />
                </div>
                <DatePicker preset={datePreset} onPresetChange={setDatePreset}
                  customFrom={customFrom} customTo={customTo}
                  onCustomChange={(t, v) => t === "from" ? setCustomFrom(v) : setCustomTo(v)} />
              </div>
              <div style={{ display: "flex", gap: 3, background: T.card, borderRadius: 8, padding: 3, overflowX: "auto", width: "100%" }}>
                {tabs.map(t => (
                  <button key={t.id} onClick={() => setTab(t.id)}
                    style={{ padding: "7px 14px", borderRadius: 6, border: "none", background: tab === t.id ? T.accent : "transparent", color: tab === t.id ? "#fff" : T.textMuted, fontSize: 11, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>{t.label}</button>
                ))}
              </div>
            </div>

            {/* Overview */}
            {tab === "overview" && (
              <div className="fade-in">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 16 }}>
                  <MetricCard label="Spend" value={spend} prev={pSpend} prefix="PKR " />
                  <MetricCard label="Revenue" value={revenue} prev={pRevenue} prefix="PKR " color={T.green} />
                  <MetricCard label="ROAS" value={roas} prev={pRoas} color={roas >= 4 ? T.green : roas >= 3 ? T.amber : T.red} />
                  <MetricCard label="Purchases" value={purchases} prev={pPurchases} color={T.accent} />
                  <MetricCard label="CPA" value={cpp} prev={pCpp} prefix="PKR " color={cpp > 1500 ? T.red : cpp > 1000 ? T.amber : T.green} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 20 }}>
                  <MetricCard label="AOV" value={aov} prev={pAov} prefix="PKR " />
                  <MetricCard label="CTR" value={ctr} prev={pCtr} color={ctr < 1.5 ? T.red : T.text} />
                  <MetricCard label="CPM" value={cpm} prev={pCpm} prefix="PKR " />
                  <MetricCard label="CPC" value={cpc} prev={pCpc} prefix="PKR " />
                  <MetricCard label="Frequency" value={freq} prev={pFreq} color={freq > 3 ? T.red : freq > 2.5 ? T.amber : T.text} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                  <FunnelViz data={funnelData} />
                  <DailyChart data={dailyData} />
                </div>
              </div>
            )}

            {/* Campaigns */}
            {tab === "campaigns" && (
              <div className="fade-in">
                <p style={{ color: T.textMuted, fontSize: 12, fontWeight: 600, marginBottom: 12 }}>Campaigns — click to expand ad sets</p>
                {campaigns.filter(c => c.insights).sort((a, b) => parseFloat(b.insights?.spend || 0) - parseFloat(a.insights?.spend || 0)).map(c => (
                  <CampaignRow key={c.id} c={c} token={token} dateRange={dateRange}
                    expanded={!!expandedCampaigns[c.id]}
                    onToggle={() => setExpandedCampaigns(prev => ({ ...prev, [c.id]: !prev[c.id] }))} />
                ))}
              </div>
            )}

            {/* Ads */}
            {tab === "ads" && (
              <div className="fade-in">
                {topAds.length > 0 && (
                  <>
                    <p style={{ color: T.green, fontSize: 12, fontWeight: 600, marginBottom: 8 }}>🏆 Top Performing Ads (by ROAS)</p>
                    {topAds.map((ad, i) => <AdRow key={i} ad={ad} />)}
                  </>
                )}
                {worstAds.length > 0 && (
                  <>
                    <p style={{ color: T.red, fontSize: 12, fontWeight: 600, margin: "20px 0 8px" }}>🔴 Budget Wasters (high spend, low ROAS)</p>
                    {worstAds.map((ad, i) => <AdRow key={i} ad={ad} />)}
                  </>
                )}
                {adData.length > 0 && (
                  <>
                    <p style={{ color: T.textMuted, fontSize: 12, fontWeight: 600, margin: "20px 0 8px" }}>All Ads (by spend)</p>
                    {adData.map((ad, i) => <AdRow key={i} ad={ad} />)}
                  </>
                )}
              </div>
            )}

            {/* Placements */}
            {tab === "placements" && (
              <div className="fade-in">
                <PlacementTable data={placementData} />
              </div>
            )}

            {/* Audience */}
            {tab === "audience" && (
              <div className="fade-in">
                {/* Age & Gender */}
                <p style={{ color: T.textMuted, fontSize: 12, fontWeight: 600, marginBottom: 12 }}>Age & Gender Breakdown</p>
                {ageGenderData.length > 0 ? (
                  <div style={{ background: T.card, borderRadius: 12, border: `1px solid ${T.border}`, overflow: "auto", marginBottom: 20 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                          {["Age", "Gender", "Spend", "Purchases", "ROAS", "Spend %", ""].map(h =>
                            <th key={h} style={{ padding: "10px 12px", textAlign: h === "Age" || h === "Gender" ? "left" : "center", color: T.textDim, fontWeight: 500, fontSize: 10, textTransform: "uppercase" }}>{h}</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const totalAGSpend = ageGenderData.reduce((s, d) => s + parseFloat(d.spend || 0), 0);
                          return ageGenderData
                            .sort((a, b) => parseFloat(b.spend || 0) - parseFloat(a.spend || 0))
                            .slice(0, 15)
                            .map((d, i) => {
                              const dSpend = parseFloat(d.spend || 0);
                              const dPurchases = extractPurchases(d.actions);
                              const dRoas = extractROAS(d.purchase_roas);
                              const spendPct = totalAGSpend > 0 ? (dSpend / totalAGSpend * 100) : 0;
                              const isTop = dRoas >= 4 && dSpend > totalAGSpend * 0.05;
                              return (
                                <tr key={i} style={{ borderBottom: `1px solid ${T.border}`, background: isTop ? T.greenSoft : "transparent" }}>
                                  <td style={{ padding: "10px 12px", fontWeight: 600 }}>{d.age}</td>
                                  <td style={{ padding: "10px 12px", color: T.textMuted, textTransform: "capitalize" }}>{d.gender === "male" ? "👨 Male" : d.gender === "female" ? "👩 Female" : d.gender}</td>
                                  <td style={{ textAlign: "center" }}>{fmtCurrency(dSpend)}</td>
                                  <td style={{ textAlign: "center", fontWeight: 600 }}>{dPurchases}</td>
                                  <td style={{ textAlign: "center", fontWeight: 700, color: dRoas >= 4 ? T.green : dRoas >= 3 ? T.amber : T.red }}>{dRoas.toFixed(2)}x</td>
                                  <td style={{ textAlign: "center" }}>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                                      <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 3, height: 6, width: 60 }}>
                                        <div style={{ background: T.accent, borderRadius: 3, height: 6, width: `${Math.min(spendPct * 2, 100)}%` }} />
                                      </div>
                                      <span style={{ fontSize: 10, color: T.textDim }}>{spendPct.toFixed(1)}%</span>
                                    </div>
                                  </td>
                                  <td style={{ textAlign: "center" }}>
                                    {isTop && <span style={{ padding: "2px 6px", borderRadius: 4, fontSize: 9, fontWeight: 700, background: T.greenSoft, color: T.green }}>Top Segment</span>}
                                  </td>
                                </tr>
                              );
                            });
                        })()}
                      </tbody>
                    </table>
                  </div>
                ) : <p style={{ color: T.textDim, fontSize: 12, textAlign: "center", padding: 20 }}>No age/gender data</p>}

                {/* Device Breakdown */}
                <p style={{ color: T.textMuted, fontSize: 12, fontWeight: 600, marginBottom: 12 }}>Device Performance</p>
                {deviceData.length > 0 ? (
                  <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(deviceData.length, 4)}, 1fr)`, gap: 10 }}>
                    {deviceData.map((d, i) => {
                      const dSpend = parseFloat(d.spend || 0);
                      const dPurchases = extractPurchases(d.actions);
                      const dRoas = extractROAS(d.purchase_roas);
                      const dCtr = parseFloat(d.ctr || 0);
                      const dCpm = parseFloat(d.cpm || 0);
                      const deviceIcon = d.device_platform === "mobile_app" || d.device_platform === "mobile_web" ? "📱" : d.device_platform === "desktop" ? "💻" : "📟";
                      const deviceName = d.device_platform === "mobile_app" ? "Mobile App" : d.device_platform === "mobile_web" ? "Mobile Web" : d.device_platform === "desktop" ? "Desktop" : d.device_platform;
                      return (
                        <div key={i} style={{ background: T.card, borderRadius: 12, padding: 18, border: `1px solid ${T.border}`, textAlign: "center" }}>
                          <p style={{ fontSize: 28, margin: "0 0 4px" }}>{deviceIcon}</p>
                          <p style={{ color: T.text, fontSize: 13, fontWeight: 600, margin: "0 0 12px" }}>{deviceName}</p>
                          <div style={{ textAlign: "left" }}>
                            {[
                              { l: "Spend", v: fmtCurrency(dSpend) },
                              { l: "Purchases", v: dPurchases },
                              { l: "ROAS", v: `${dRoas.toFixed(2)}x`, c: dRoas >= 4 ? T.green : dRoas >= 3 ? T.amber : T.red },
                              { l: "CTR", v: `${dCtr}%`, c: dCtr < 1.5 ? T.red : T.text },
                              { l: "CPM", v: fmtCurrency(dCpm) },
                            ].map(m => (
                              <div key={m.l} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                <span style={{ color: T.textDim, fontSize: 10 }}>{m.l}</span>
                                <span style={{ color: m.c || T.text, fontSize: 12, fontWeight: 600 }}>{m.v}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : <p style={{ color: T.textDim, fontSize: 12, textAlign: "center", padding: 20 }}>No device data</p>}
              </div>
            )}

            {/* Shopify */}
            {tab === "shopify" && (
              <div className="fade-in">
                {!shopifyData && !shopifyLoading && (
                  <div style={{ textAlign: "center", padding: 40 }}>
                    <p style={{ fontSize: 32, marginBottom: 8 }}>🛍</p>
                    <p style={{ color: T.textMuted, fontSize: 14, marginBottom: 16 }}>Load Shopify data for this period</p>
                    <button onClick={loadShopifyData} style={{ padding: "12px 32px", background: "#96BF48", border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Load Shopify Data</button>
                  </div>
                )}
                {shopifyLoading && (
                  <div style={{ textAlign: "center", padding: 60 }}>
                    <div style={{ width: 36, height: 36, border: `3px solid ${T.border}`, borderTopColor: "#96BF48", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
                    <p style={{ color: T.textMuted, fontSize: 13 }}>Loading Shopify data...</p>
                  </div>
                )}
                {shopifyData && !shopifyData.error && !shopifyLoading && (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 16 }}>
                      <MetricCard label="Shopify Revenue" value={shopifyData.totalRevenue} prefix="PKR " color={T.green} />
                      <MetricCard label="Orders" value={shopifyData.totalOrders} color={T.accent} />
                      <MetricCard label="AOV" value={shopifyData.aov} prefix="PKR " />
                      <MetricCard label="True ROAS" value={shopifyData.trueRoas} color={shopifyData.trueRoas >= 4 ? T.green : shopifyData.trueRoas >= 3 ? T.amber : T.red} />
                      <MetricCard label="Customers" value={shopifyData.customerCount} color={T.purple} />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
                      <div style={{ background: T.card, borderRadius: 12, padding: "16px 18px", border: `1px solid ${T.border}` }}>
                        <p style={{ color: T.textDim, fontSize: 10, margin: 0, textTransform: "uppercase", letterSpacing: 1 }}>Fulfilled</p>
                        <p style={{ color: T.green, fontSize: 22, fontWeight: 700, margin: "6px 0 0" }}>{shopifyData.fulfilled}</p>
                      </div>
                      <div style={{ background: T.card, borderRadius: 12, padding: "16px 18px", border: `1px solid ${T.border}` }}>
                        <p style={{ color: T.textDim, fontSize: 10, margin: 0, textTransform: "uppercase", letterSpacing: 1 }}>Cancelled</p>
                        <p style={{ color: T.red, fontSize: 22, fontWeight: 700, margin: "6px 0 0" }}>{shopifyData.cancelled}</p>
                      </div>
                      <div style={{ background: T.card, borderRadius: 12, padding: "16px 18px", border: `1px solid ${T.border}` }}>
                        <p style={{ color: T.textDim, fontSize: 10, margin: 0, textTransform: "uppercase", letterSpacing: 1 }}>Refunded</p>
                        <p style={{ color: T.amber, fontSize: 22, fontWeight: 700, margin: "6px 0 0" }}>{shopifyData.refunded}</p>
                      </div>
                      <div style={{ background: T.card, borderRadius: 12, padding: "16px 18px", border: `1px solid ${T.border}` }}>
                        <p style={{ color: T.textDim, fontSize: 10, margin: 0, textTransform: "uppercase", letterSpacing: 1 }}>Ad Conv. Rate</p>
                        <p style={{ color: T.text, fontSize: 22, fontWeight: 700, margin: "6px 0 0" }}>{funnelData?.link_clicks > 0 ? ((shopifyData.totalOrders / funnelData.link_clicks) * 100).toFixed(2) : "0"}%</p>
                      </div>
                    </div>

                    {shopifyData.dailySales.length > 0 && (
                      <div style={{ background: T.card, borderRadius: 12, padding: 20, border: `1px solid ${T.border}`, marginBottom: 16 }}>
                        <p style={{ color: T.textMuted, fontSize: 12, fontWeight: 600, margin: "0 0 12px" }}>Daily Revenue</p>
                        <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 140 }}>
                          {(() => {
                            const maxRev = Math.max(...shopifyData.dailySales.map(d => d.revenue));
                            return shopifyData.dailySales.map((d, i) => (
                              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }} title={`${d.date}\nOrders: ${d.orders}\nRevenue: PKR ${d.revenue.toFixed(0)}`}>
                                <div style={{ width: "100%", maxWidth: 20, height: maxRev > 0 ? (d.revenue / maxRev) * 140 : 0, background: "#96BF48", borderRadius: "3px 3px 0 0", opacity: 0.8, cursor: "pointer" }} />
                              </div>
                            ));
                          })()}
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                          <span style={{ color: T.textDim, fontSize: 9 }}>{shopifyData.dailySales[0]?.date?.slice(5)}</span>
                          <span style={{ color: T.textDim, fontSize: 9 }}>{shopifyData.dailySales[shopifyData.dailySales.length - 1]?.date?.slice(5)}</span>
                        </div>
                      </div>
                    )}

                    <p style={{ color: T.textMuted, fontSize: 12, fontWeight: 600, marginBottom: 10 }}>Top Selling Products</p>
                    <div style={{ background: T.card, borderRadius: 12, border: `1px solid ${T.border}`, overflow: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                        <thead>
                          <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                            {["#", "Product", "Qty Sold", "Revenue"].map(h =>
                              <th key={h} style={{ padding: "10px 14px", textAlign: h === "Product" ? "left" : "center", color: T.textDim, fontWeight: 500, fontSize: 10, textTransform: "uppercase" }}>{h}</th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {shopifyData.topProducts.map((p, i) => (
                            <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}>
                              <td style={{ padding: "10px 14px", textAlign: "center", color: i < 3 ? "#96BF48" : T.textDim, fontWeight: 700 }}>{i + 1}</td>
                              <td style={{ padding: "10px 14px", fontWeight: 500 }}>{p.title}</td>
                              <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 600 }}>{p.qty}</td>
                              <td style={{ padding: "10px 14px", textAlign: "center", color: T.green, fontWeight: 600 }}>{fmtCurrency(p.revenue)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
                {shopifyData?.error && (
                  <div style={{ textAlign: "center", padding: 40 }}>
                    <p style={{ color: T.red, fontSize: 14, marginBottom: 8 }}>Shopify Connection Error</p>
                    <p style={{ color: T.textDim, fontSize: 12 }}>{typeof shopifyData.error === "string" ? shopifyData.error : "Check Shopify token in Vercel environment variables"}</p>
                    <button onClick={loadShopifyData} style={{ marginTop: 12, padding: "8px 20px", background: T.card, border: `1px solid ${T.border}`, borderRadius: 6, color: T.text, fontSize: 11, cursor: "pointer" }}>Retry</button>
                  </div>
                )}
              </div>
            )}

            {/* Alerts */}
            {tab === "alerts" && (
              <div className="fade-in">
                {/* META ADS ALERTS */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, padding: "10px 16px", background: T.accentSoft, borderRadius: 8 }}>
                  <span style={{ fontSize: 16 }}>📢</span>
                  <p style={{ color: T.accent, fontSize: 14, fontWeight: 700, margin: 0 }}>META ADS ALERTS</p>
                </div>
                {(() => {
                  const metaAlerts = [];
                  if (freq > 3.5) metaAlerts.push({ type: "critical", icon: "🔴", title: "Frequency Very High", msg: `Account frequency is ${freq.toFixed(2)} — audience is heavily saturated. Fresh audiences or new campaigns needed urgently.`, metric: `Freq: ${freq.toFixed(2)}` });
                  else if (freq > 2.5) metaAlerts.push({ type: "warning", icon: "🟡", title: "Frequency Rising", msg: `Frequency at ${freq.toFixed(2)} — approaching saturation. Consider audience expansion or creative refresh.`, metric: `Freq: ${freq.toFixed(2)}` });

                  const ctrChange = pCtr > 0 ? ((ctr - pCtr) / pCtr * 100) : 0;
                  if (ctrChange < -20) metaAlerts.push({ type: "critical", icon: "🔴", title: "CTR Crashed", msg: `CTR dropped ${Math.abs(ctrChange).toFixed(0)}% vs previous period (${pCtr.toFixed(2)}% → ${ctr.toFixed(2)}%). Creative fatigue or audience saturation likely.`, metric: `CTR: ${ctr}%` });
                  else if (ctrChange < -10) metaAlerts.push({ type: "warning", icon: "🟡", title: "CTR Declining", msg: `CTR down ${Math.abs(ctrChange).toFixed(0)}% vs previous. Monitor closely — may need creative refresh.`, metric: `CTR: ${ctr}%` });

                  const cpcChange = pCpc > 0 ? ((cpc - pCpc) / pCpc * 100) : 0;
                  if (cpcChange > 50) metaAlerts.push({ type: "critical", icon: "🔴", title: "CPC Doubled", msg: `CPC increased ${cpcChange.toFixed(0)}% — from PKR ${pCpc.toFixed(0)} to PKR ${cpc.toFixed(0)}. Check targeting, creative relevance, and competition.`, metric: `CPC: PKR ${cpc.toFixed(0)}` });
                  else if (cpcChange > 25) metaAlerts.push({ type: "warning", icon: "🟡", title: "CPC Rising", msg: `CPC up ${cpcChange.toFixed(0)}% vs previous period. Efficiency declining.`, metric: `CPC: PKR ${cpc.toFixed(0)}` });

                  const roasChange = pRoas > 0 ? ((roas - pRoas) / pRoas * 100) : 0;
                  if (roas < 2) metaAlerts.push({ type: "critical", icon: "🔴", title: "ROAS Below Break-even", msg: `ROAS at ${roas.toFixed(2)}x — likely losing money. Pause underperforming campaigns and reallocate budget.`, metric: `ROAS: ${roas.toFixed(2)}x` });
                  else if (roasChange < -20) metaAlerts.push({ type: "warning", icon: "🟡", title: "ROAS Declining", msg: `ROAS dropped ${Math.abs(roasChange).toFixed(0)}% from ${pRoas.toFixed(2)}x to ${roas.toFixed(2)}x. Investigate campaign-level performance.`, metric: `ROAS: ${roas.toFixed(2)}x` });

                  const cpmChange = pCpm > 0 ? ((cpm - pCpm) / pCpm * 100) : 0;
                  if (cpmChange > 40) metaAlerts.push({ type: "warning", icon: "🟡", title: "CPM Spiked", msg: `CPM increased ${cpmChange.toFixed(0)}% — auction competition is higher or audience quality declining.`, metric: `CPM: PKR ${cpm.toFixed(0)}` });

                  const deadAds = adData.filter(a => { const af = parseFloat(a.frequency || 0); const ac = parseFloat(a.ctr || 0); const as2 = parseFloat(a.spend || 0); return (af > 3.5 || (ac < 1.0 && as2 > 1000)); });
                  if (deadAds.length > 0) metaAlerts.push({ type: "critical", icon: "🔴", title: `${deadAds.length} Dead Creatives`, msg: `${deadAds.map(a => a.ad_name).slice(0, 3).join(", ")}${deadAds.length > 3 ? ` +${deadAds.length - 3} more` : ""} — replace these ASAP, budget waste ho raha hai.`, metric: `${deadAds.length} ads` });

                  const fatiguingAds = adData.filter(a => { const af = parseFloat(a.frequency || 0); const ac = parseFloat(a.ctr || 0); const ar = extractROAS(a.purchase_roas); const as2 = parseFloat(a.spend || 0); return as2 > 500 && (af > 2.5 || ac < 1.5 || ar < 3) && !(af > 3.5 || (ac < 1.0 && as2 > 1000)); });
                  if (fatiguingAds.length > 0) metaAlerts.push({ type: "warning", icon: "🟡", title: `${fatiguingAds.length} Creatives Fatiguing`, msg: `${fatiguingAds.map(a => a.ad_name).slice(0, 3).join(", ")} — starting to decline. Prepare replacements.`, metric: `${fatiguingAds.length} ads` });

                  const metaPurchases = purchases;
                  const linkClicks = funnelData?.link_clicks || 0;
                  const adConvRate = linkClicks > 0 ? (metaPurchases / linkClicks * 100) : 0;
                  if (adConvRate < 0.5 && linkClicks > 100) metaAlerts.push({ type: "critical", icon: "🔴", title: "Ad Conversion Rate Very Low", msg: `Only ${adConvRate.toFixed(2)}% of ad clicks converting to purchase. Landing page or product page needs urgent optimization.`, metric: `Conv: ${adConvRate.toFixed(2)}%` });
                  else if (adConvRate < 1 && linkClicks > 100) metaAlerts.push({ type: "warning", icon: "🟡", title: "Ad Conversion Rate Low", msg: `${adConvRate.toFixed(2)}% conversion rate from ad clicks. Check landing page experience and product page.`, metric: `Conv: ${adConvRate.toFixed(2)}%` });

                  if (roas >= 5) metaAlerts.push({ type: "positive", icon: "🟢", title: "Strong ROAS", msg: `ROAS at ${roas.toFixed(2)}x — excellent performance. Consider scaling budget if frequency allows.`, metric: `ROAS: ${roas.toFixed(2)}x` });
                  const scaleAds = adData.filter(a => extractROAS(a.purchase_roas) >= 5 && parseFloat(a.spend || 0) > 500);
                  if (scaleAds.length > 0) metaAlerts.push({ type: "positive", icon: "🟢", title: `${scaleAds.length} Ads Ready to Scale`, msg: `${scaleAds.map(a => a.ad_name).slice(0, 3).join(", ")} — high ROAS with decent spend. Increase budget.`, metric: `${scaleAds.length} ads` });

                  if (metaAlerts.length === 0) metaAlerts.push({ type: "positive", icon: "✅", title: "Meta Ads All Clear", msg: "No major issues detected in Meta Ads.", metric: "" });

                  return metaAlerts.map((a, i) => (
                    <div key={`m${i}`} style={{ background: T.card, borderRadius: 12, border: `1px solid ${T.border}`, padding: "14px 18px", marginBottom: 8, borderLeft: `4px solid ${a.type === "critical" ? T.red : a.type === "warning" ? T.amber : a.type === "info" ? T.purple : T.green}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{a.icon} {a.title}</p>
                        {a.metric && <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 10, fontWeight: 600, background: a.type === "critical" ? T.redSoft : a.type === "warning" ? T.amberSoft : a.type === "info" ? T.purpleSoft : T.greenSoft, color: a.type === "critical" ? T.red : a.type === "warning" ? T.amber : a.type === "info" ? T.purple : T.green }}>{a.metric}</span>}
                      </div>
                      <p style={{ color: T.textMuted, fontSize: 11, margin: 0, lineHeight: 1.5 }}>{a.msg}</p>
                    </div>
                  ));
                })()}

                {/* SHOPIFY ALERTS */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "24px 0 12px", padding: "10px 16px", background: "rgba(150,191,72,0.12)", borderRadius: 8 }}>
                  <span style={{ fontSize: 16 }}>🛍</span>
                  <p style={{ color: "#96BF48", fontSize: 14, fontWeight: 700, margin: 0 }}>SHOPIFY ALERTS</p>
                  {!shopifyData && <span style={{ color: T.textDim, fontSize: 11 }}>(Load Shopify data from Shopify tab first)</span>}
                </div>
                {shopifyData && !shopifyData.error ? (() => {
                  const shopAlerts = [];
                  const sRev = shopifyData.totalRevenue || 0;
                  const sOrders = shopifyData.totalOrders || 0;
                  const sAov = shopifyData.aov || 0;
                  const sTrueRoas = shopifyData.trueRoas || 0;
                  const sFulfilled = shopifyData.fulfilled || 0;
                  const sCancelled = shopifyData.cancelled || 0;
                  const sRefunded = shopifyData.refunded || 0;
                  const cancelRate = sOrders > 0 ? (sCancelled / sOrders * 100) : 0;
                  const refundRate = sOrders > 0 ? (sRefunded / sOrders * 100) : 0;
                  const fulfillRate = sOrders > 0 ? (sFulfilled / sOrders * 100) : 0;
                  const unfulfilled = sOrders - sFulfilled - sCancelled;
                  const unfulfilledRate = sOrders > 0 ? (unfulfilled / sOrders * 100) : 0;
                  const metaReportedRoas = roas;
                  const roasGap = metaReportedRoas > 0 ? metaReportedRoas / Math.max(sTrueRoas, 0.01) : 0;
                  const costPerShopifyOrder = spend > 0 && sOrders > 0 ? spend / sOrders : 0;
                  const metaVsShopifyOrders = purchases > 0 && sOrders > 0 ? Math.abs(purchases - sOrders) / purchases * 100 : 0;

                  // True ROAS
                  if (sTrueRoas < 1) shopAlerts.push({ type: "critical", icon: "🔴", title: "True ROAS Below 1x — Losing Money", msg: `Shopify actual revenue ÷ Meta spend = ${sTrueRoas.toFixed(2)}x. You are spending more on ads than you are making. Urgent action needed — pause low performers.`, metric: `True ROAS: ${sTrueRoas.toFixed(2)}x` });
                  else if (sTrueRoas < 1.5) shopAlerts.push({ type: "critical", icon: "🔴", title: "True ROAS Dangerously Low", msg: `True ROAS at ${sTrueRoas.toFixed(2)}x — barely covering ad spend, not accounting for COGS, shipping, returns. Likely net negative.`, metric: `True ROAS: ${sTrueRoas.toFixed(2)}x` });
                  else if (sTrueRoas < 2.5) shopAlerts.push({ type: "warning", icon: "🟡", title: "True ROAS Needs Improvement", msg: `True ROAS at ${sTrueRoas.toFixed(2)}x — profitable but thin margins after COGS and shipping. Optimize for better efficiency.`, metric: `True ROAS: ${sTrueRoas.toFixed(2)}x` });
                  else if (sTrueRoas >= 3) shopAlerts.push({ type: "positive", icon: "🟢", title: "True ROAS Strong — Scale Opportunity", msg: `True ROAS at ${sTrueRoas.toFixed(2)}x — healthy margins. Consider increasing ad budget to scale revenue.`, metric: `True ROAS: ${sTrueRoas.toFixed(2)}x` });

                  // Meta vs True ROAS gap
                  if (roasGap > 3) shopAlerts.push({ type: "info", icon: "🟣", title: "Meta Over-Reporting by 3x+", msg: `Meta says ${metaReportedRoas.toFixed(2)}x ROAS but Shopify actual is ${sTrueRoas.toFixed(2)}x — ${roasGap.toFixed(1)}x gap. Meta is heavily over-attributing. Don't trust Meta numbers for budget decisions.`, metric: `Gap: ${roasGap.toFixed(1)}x` });
                  else if (roasGap > 2) shopAlerts.push({ type: "info", icon: "🟣", title: "Meta Over-Reporting by 2x+", msg: `Meta reports ${metaReportedRoas.toFixed(2)}x but actual Shopify ROAS is ${sTrueRoas.toFixed(2)}x. Significant attribution gap — use Shopify numbers for real decisions.`, metric: `Gap: ${roasGap.toFixed(1)}x` });

                  // Cancellation alerts (10% threshold as requested)
                  if (cancelRate > 10) shopAlerts.push({ type: "critical", icon: "🔴", title: "Cancellation Rate CRITICAL", msg: `${cancelRate.toFixed(1)}% orders cancelled (${sCancelled} of ${sOrders}). Above 10% threshold — investigate product quality, delivery expectations, or wrong audience targeting.`, metric: `Cancel: ${cancelRate.toFixed(1)}%` });
                  else if (cancelRate > 5) shopAlerts.push({ type: "warning", icon: "🟡", title: "Cancellation Rate High", msg: `${cancelRate.toFixed(1)}% cancellation rate. Rising cancellations indicate audience-product mismatch or post-purchase buyer remorse.`, metric: `Cancel: ${cancelRate.toFixed(1)}%` });

                  // Returns/Refund alerts (15% threshold as requested)
                  if (refundRate > 15) shopAlerts.push({ type: "critical", icon: "🔴", title: "Returns/Refunds CRITICAL", msg: `${refundRate.toFixed(1)}% refund rate (${sRefunded} of ${sOrders}). Above 15% threshold — serious product quality or expectation mismatch. Check product descriptions, images vs reality, and sizing.`, metric: `Refunds: ${refundRate.toFixed(1)}%` });
                  else if (refundRate > 5) shopAlerts.push({ type: "warning", icon: "🟡", title: "Refund Rate Elevated", msg: `${refundRate.toFixed(1)}% refund rate. Monitor product reviews and common refund reasons.`, metric: `Refunds: ${refundRate.toFixed(1)}%` });
                  else if (refundRate === 0 && sOrders > 20) shopAlerts.push({ type: "positive", icon: "🟢", title: "Zero Refunds", msg: `No refunds in this period — product quality and customer satisfaction is excellent.`, metric: "0 refunds" });

                  // Fulfillment
                  if (fulfillRate < 80 && sOrders > 10) shopAlerts.push({ type: "critical", icon: "🔴", title: "Fulfillment Rate Critical", msg: `Only ${fulfillRate.toFixed(0)}% orders fulfilled. ${unfulfilled} orders pending — customers waiting. Speed up fulfillment or risk cancellations and bad reviews.`, metric: `Fulfilled: ${fulfillRate.toFixed(0)}%` });
                  else if (fulfillRate < 90 && sOrders > 10) shopAlerts.push({ type: "warning", icon: "🟡", title: "Fulfillment Needs Attention", msg: `${fulfillRate.toFixed(0)}% fulfillment rate. ${unfulfilled} orders still pending.`, metric: `Fulfilled: ${fulfillRate.toFixed(0)}%` });
                  else if (fulfillRate >= 95 && sOrders > 10) shopAlerts.push({ type: "positive", icon: "🟢", title: "Fulfillment Excellent", msg: `${fulfillRate.toFixed(0)}% fulfillment rate — operations running smoothly.`, metric: `Fulfilled: ${fulfillRate.toFixed(0)}%` });

                  // AOV
                  if (sAov < 2000 && sOrders > 10) shopAlerts.push({ type: "warning", icon: "🟡", title: "AOV Low", msg: `Average order value PKR ${sAov.toFixed(0)}. Consider upselling, bundling, or minimum order incentives to increase AOV.`, metric: `AOV: PKR ${sAov.toFixed(0)}` });
                  else if (sAov > 8000) shopAlerts.push({ type: "positive", icon: "🟢", title: "AOV Strong", msg: `AOV at PKR ${sAov.toFixed(0)} — customers buying premium. Upsell strategy working.`, metric: `AOV: PKR ${sAov.toFixed(0)}` });

                  // Product dependency
                  if (shopifyData.topProducts && shopifyData.topProducts.length > 0) {
                    const topRev = shopifyData.topProducts[0]?.revenue || 0;
                    const topPct = sRev > 0 ? (topRev / sRev * 100) : 0;
                    if (topPct > 50) shopAlerts.push({ type: "warning", icon: "🟡", title: "Single Product Dependency", msg: `"${shopifyData.topProducts[0]?.title}" accounts for ${topPct.toFixed(0)}% of total revenue. High risk — if this product slows down, entire revenue drops. Diversify product mix.`, metric: `${topPct.toFixed(0)}% revenue` });
                    const top3Rev = shopifyData.topProducts.slice(0, 3).reduce((s, p) => s + (p.revenue || 0), 0);
                    const top3Pct = sRev > 0 ? (top3Rev / sRev * 100) : 0;
                    if (top3Pct > 80 && topPct <= 50) shopAlerts.push({ type: "warning", icon: "🟡", title: "Top 3 Products = 80%+ Revenue", msg: `Top 3 products carry ${top3Pct.toFixed(0)}% of revenue. Product catalog needs diversification for stability.`, metric: `Top 3: ${top3Pct.toFixed(0)}%` });
                  }

                  // Cost per Shopify order
                  if (costPerShopifyOrder > sAov * 0.5 && sOrders > 10) shopAlerts.push({ type: "critical", icon: "🔴", title: "Ad Cost Per Order Too High", msg: `Spending PKR ${costPerShopifyOrder.toFixed(0)} per Shopify order vs AOV of PKR ${sAov.toFixed(0)}. Ad cost is ${(costPerShopifyOrder / sAov * 100).toFixed(0)}% of order value — not sustainable after COGS.`, metric: `CPA: PKR ${costPerShopifyOrder.toFixed(0)}` });
                  else if (costPerShopifyOrder > sAov * 0.3 && sOrders > 10) shopAlerts.push({ type: "warning", icon: "🟡", title: "Ad Cost Per Order High", msg: `PKR ${costPerShopifyOrder.toFixed(0)} per Shopify order (${(costPerShopifyOrder / sAov * 100).toFixed(0)}% of AOV). Optimize campaigns to reduce acquisition cost.`, metric: `CPA: PKR ${costPerShopifyOrder.toFixed(0)}` });

                  // Meta vs Shopify order mismatch
                  if (metaVsShopifyOrders > 30 && purchases > 10 && sOrders > 10) shopAlerts.push({ type: "info", icon: "🟣", title: "Order Count Mismatch — Tracking Issue", msg: `Meta reports ${purchases} purchases but Shopify shows ${sOrders} orders — ${metaVsShopifyOrders.toFixed(0)}% difference. Check pixel firing, duplicate events, or attribution window settings.`, metric: `Gap: ${Math.abs(purchases - sOrders)} orders` });

                  // Revenue
                  if (sRev < spend) shopAlerts.push({ type: "critical", icon: "🔴", title: "Revenue Below Ad Spend", msg: `Shopify revenue PKR ${fmt(sRev)} is less than Meta ad spend PKR ${fmt(spend)}. You are losing money on every rupee spent on ads.`, metric: `Loss: PKR ${fmt(spend - sRev)}` });

                  // Daily patterns
                  if (shopifyData.dailySales && shopifyData.dailySales.length > 3) {
                    const last3 = shopifyData.dailySales.slice(-3);
                    const avgRev = shopifyData.dailySales.reduce((s, d) => s + d.revenue, 0) / shopifyData.dailySales.length;
                    const last3Avg = last3.reduce((s, d) => s + d.revenue, 0) / 3;
                    if (last3Avg < avgRev * 0.5 && avgRev > 0) shopAlerts.push({ type: "critical", icon: "🔴", title: "Revenue Dropping — Last 3 Days", msg: `Last 3 days average PKR ${fmt(last3Avg)}/day vs period average PKR ${fmt(avgRev)}/day. ${((1 - last3Avg / avgRev) * 100).toFixed(0)}% drop — something changed recently.`, metric: `↓${((1 - last3Avg / avgRev) * 100).toFixed(0)}%` });
                    const zeroDays = shopifyData.dailySales.filter(d => d.orders === 0).length;
                    if (zeroDays > 0) shopAlerts.push({ type: "warning", icon: "🟡", title: `${zeroDays} Zero-Order Days`, msg: `${zeroDays} days with zero orders in this period. Check if ads were running and store was accessible on those days.`, metric: `${zeroDays} days` });
                  }

                  if (shopAlerts.length === 0) shopAlerts.push({ type: "positive", icon: "✅", title: "Shopify All Clear", msg: "No major issues detected in Shopify data.", metric: "" });

                  return shopAlerts.map((a, i) => (
                    <div key={`s${i}`} style={{ background: T.card, borderRadius: 12, border: `1px solid ${T.border}`, padding: "14px 18px", marginBottom: 8, borderLeft: `4px solid ${a.type === "critical" ? T.red : a.type === "warning" ? T.amber : a.type === "info" ? T.purple : T.green}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{a.icon} {a.title}</p>
                        {a.metric && <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 10, fontWeight: 600, background: a.type === "critical" ? T.redSoft : a.type === "warning" ? T.amberSoft : a.type === "info" ? T.purpleSoft : T.greenSoft, color: a.type === "critical" ? T.red : a.type === "warning" ? T.amber : a.type === "info" ? T.purple : T.green }}>{a.metric}</span>}
                      </div>
                      <p style={{ color: T.textMuted, fontSize: 11, margin: 0, lineHeight: 1.5 }}>{a.msg}</p>
                    </div>
                  ));
                })() : (
                  <p style={{ color: T.textDim, fontSize: 12, textAlign: "center", padding: 20 }}>Shopify tab se pehle data load karo — phir alerts yahan dikhein gi</p>
                )}
              </div>
            )}

            {/* Monthly */}
            {tab === "monthly" && (
              <div className="fade-in">
                <p style={{ color: T.textMuted, fontSize: 12, fontWeight: 600, marginBottom: 16 }}>Month-over-Month Comparison</p>
                <MonthlyChart data={monthlyData} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
