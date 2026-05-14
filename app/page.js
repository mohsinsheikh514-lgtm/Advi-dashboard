"use client";
import { useState, useCallback } from "react";
import { fetchAccounts, fetchAccountInsights, fetchCampaigns, fetchMonthlyInsights, fetchAdInsights, extractPurchases, extractROAS, fmt, fmtCurrency } from "../lib/meta-api";

const T = {
  bg: "#0B0E14", card: "#12161F", cardHover: "#181D28", border: "#1E2433",
  accent: "#3B82F6", accentSoft: "rgba(59,130,246,0.12)",
  green: "#10B981", greenSoft: "rgba(16,185,129,0.12)",
  red: "#EF4444", redSoft: "rgba(239,68,68,0.12)",
  amber: "#F59E0B", amberSoft: "rgba(245,158,11,0.12)",
  text: "#E2E8F0", textMuted: "#94A3B8", textDim: "#64748B",
};

function StatCard({ label, value, color = T.text }) {
  return (
    <div style={{ background: T.card, borderRadius: 12, padding: "18px 20px", border: `1px solid ${T.border}` }}>
      <p style={{ color: T.textDim, fontSize: 11, margin: 0, textTransform: "uppercase", letterSpacing: 1 }}>{label}</p>
      <p style={{ color, fontSize: 26, fontWeight: 700, margin: "6px 0 0", fontFamily: "'DM Sans', sans-serif" }}>{value}</p>
    </div>
  );
}

function FatigueAlert({ ad }) {
  const freq = parseFloat(ad.frequency || 0);
  const ctr = parseFloat(ad.ctr || 0);
  const roas = extractROAS(ad.purchase_roas);
  const spend = parseFloat(ad.spend || 0);

  let msg = "Healthy", color = T.green, bg = T.greenSoft;
  if (freq > 3.5 || (ctr < 1.0 && spend > 1000)) { msg = "Creative Dead — Replace"; color = T.red; bg = T.redSoft; }
  else if (freq > 2.5 || ctr < 1.5 || roas < 3) { msg = "Fatigue Starting"; color = T.amber; bg = T.amberSoft; }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: T.card, borderRadius: 10, border: `1px solid ${T.border}`, marginBottom: 8, borderLeft: `3px solid ${color}` }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ color: T.text, fontSize: 12, fontWeight: 500, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ad.ad_name}</p>
        <div style={{ display: "flex", gap: 16, marginTop: 6, flexWrap: "wrap" }}>
          <span style={{ color: T.textDim, fontSize: 11 }}>Freq: <b style={{ color: freq > 3 ? T.red : freq > 2.5 ? T.amber : T.text }}>{freq.toFixed(2)}</b></span>
          <span style={{ color: T.textDim, fontSize: 11 }}>CTR: <b style={{ color: ctr < 1.5 ? T.red : T.text }}>{ctr}%</b></span>
          <span style={{ color: T.textDim, fontSize: 11 }}>ROAS: <b style={{ color: roas < 3 ? T.red : roas < 4 ? T.amber : T.green }}>{roas.toFixed(2)}x</b></span>
          <span style={{ color: T.textDim, fontSize: 11 }}>Spend: {fmtCurrency(spend)}</span>
        </div>
      </div>
      <span style={{ padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: bg, color, whiteSpace: "nowrap", marginLeft: 12 }}>{msg}</span>
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
            <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 8 }}>
              {[
                { l: "ROAS", v: `${roas.toFixed(2)}x`, c: roas >= 4 ? T.green : roas >= 3 ? T.amber : T.red, extra: roasChange !== null ? ` ${roasChange >= 0 ? "↑" : "↓"}${Math.abs(roasChange).toFixed(0)}%` : "" },
                { l: "Purchases", v: purchases, c: T.text },
                { l: "CTR", v: `${ctr.toFixed(2)}%`, c: ctr < 1.5 ? T.red : T.text },
                { l: "Freq", v: freq.toFixed(2), c: freq > 3 ? T.red : freq > 2.5 ? T.amber : T.text },
              ].map(row => (
                <div key={row.l} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ color: T.textDim, fontSize: 10 }}>{row.l}</span>
                  <span style={{ color: row.c, fontSize: 12, fontWeight: 600 }}>{row.v}{row.extra && <span style={{ fontSize: 9, color: row.extra.includes("↑") ? T.green : T.red }}>{row.extra}</span>}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Home() {
  const [token, setToken] = useState(process.env.NEXT_PUBLIC_TOKEN || "");
  const [connected, setConnected] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [selectedAcc, setSelectedAcc] = useState(null);
  const [insights, setInsights] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [adData, setAdData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("overview");
  const [search, setSearch] = useState("");

  const now = new Date();
  const thirtyAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const dateRange = { since: thirtyAgo.toISOString().split("T")[0], until: now.toISOString().split("T")[0] };

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
    setLoading(true); setSelectedAcc(acc); setTab("overview");
    try {
      const [ins, camps, monthly, ads] = await Promise.all([
        fetchAccountInsights(acc.id, token, dateRange),
        fetchCampaigns(acc.id, token, dateRange),
        fetchMonthlyInsights(acc.id, token, 4),
        fetchAdInsights(acc.id, token, dateRange),
      ]);
      setInsights(ins); setCampaigns(camps); setMonthlyData(monthly); setAdData(ads);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, [token, dateRange]);

  const filteredAccounts = accounts.filter(a =>
    (a.name || a.id).toLowerCase().includes(search.toLowerCase())
  );

  // ─── Login Screen ───
  if (!connected) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: T.bg }}>
        <div style={{ textAlign: "center", maxWidth: 460, padding: 24 }}>
          <div style={{ fontSize: 44, marginBottom: 8 }}>📊</div>
          <h1 style={{ color: T.text, fontSize: 24, fontWeight: 700, margin: "0 0 4px" }}>ADVI MEDIA</h1>
          <p style={{ color: T.textDim, fontSize: 13, margin: "0 0 36px" }}>Agency Performance Dashboard</p>
          <input type="password" value={token} onChange={e => setToken(e.target.value)}
            placeholder="Paste Meta API Token..."
            onKeyDown={e => e.key === "Enter" && connect()}
            style={{ width: "100%", padding: "14px 16px", background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, color: T.text, fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 14, fontFamily: "'JetBrains Mono', monospace" }}
          />
          <button onClick={connect}
            style={{ width: "100%", padding: "13px 0", background: T.accent, border: "none", borderRadius: 10, color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            {loading ? "Connecting..." : "Connect & Load →"}
          </button>
          {error && <p style={{ color: T.red, fontSize: 12, marginTop: 12 }}>{error}</p>}
          <p style={{ color: T.textDim, fontSize: 11, marginTop: 14 }}>Token sirf browser session mein rehta hai — kahin save nahi hota</p>
        </div>
      </div>
    );
  }

  // ─── Dashboard ───
  const spend = parseFloat(insights?.spend || 0);
  const purchases = extractPurchases(insights?.actions);
  const roas = extractROAS(insights?.purchase_roas);
  const freq = parseFloat(insights?.frequency || 0);
  const ctr = parseFloat(insights?.ctr || 0);
  const cpm = parseFloat(insights?.cpm || 0);
  const reach = parseInt(insights?.reach || 0);
  const cpp = purchases > 0 ? spend / purchases : 0;
  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "campaigns", label: "Campaigns" },
    { id: "fatigue", label: "Creative Fatigue" },
    { id: "monthly", label: "Monthly Trend" },
  ];

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: T.bg }}>
      {/* Sidebar */}
      <div style={{ width: 270, borderRight: `1px solid ${T.border}`, padding: "20px 12px", overflowY: "auto", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 8px", marginBottom: 20 }}>
          <span style={{ fontSize: 22 }}>📊</span>
          <div>
            <p style={{ color: T.text, fontSize: 15, fontWeight: 700, margin: 0 }}>ADVI MEDIA</p>
            <p style={{ color: T.textDim, fontSize: 10, margin: 0 }}>Agency Dashboard</p>
          </div>
        </div>

        {/* Search */}
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search client..."
          style={{ width: "100%", padding: "10px 12px", background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 12, outline: "none", boxSizing: "border-box", marginBottom: 12 }}
        />

        <p style={{ color: T.textDim, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, padding: "0 8px", marginBottom: 8 }}>
          Accounts ({filteredAccounts.length})
        </p>

        {filteredAccounts.map(acc => (
          <div key={acc.id} onClick={() => loadAccount(acc)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 14px", background: selectedAcc?.id === acc.id ? T.accentSoft : "transparent",
              borderRadius: 8, cursor: "pointer", borderLeft: selectedAcc?.id === acc.id ? `3px solid ${T.accent}` : "3px solid transparent",
              marginBottom: 2, transition: "all 0.15s",
            }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ color: T.text, fontSize: 12, fontWeight: selectedAcc?.id === acc.id ? 600 : 400, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {acc.name?.replace("act_", "") || acc.id}
              </p>
            </div>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: acc.account_status === 1 ? T.green : T.red, flexShrink: 0 }} />
          </div>
        ))}

        <button onClick={() => { setConnected(false); setToken(""); setAccounts([]); setSelectedAcc(null); }}
          style={{ width: "100%", marginTop: 20, padding: "10px 0", background: "rgba(239,68,68,0.1)", border: `1px solid rgba(239,68,68,0.2)`, borderRadius: 8, color: T.red, fontSize: 11, cursor: "pointer" }}>
          Disconnect
        </button>
      </div>

      {/* Main */}
      <div style={{ flex: 1, padding: "24px 32px", overflowY: "auto" }}>
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
            <p style={{ color: T.textDim, fontSize: 12, marginTop: 6 }}>Ya search bar mein client ka naam likho</p>
          </div>
        )}

        {!loading && selectedAcc && insights && (
          <>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
              <div>
                <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 2px" }}>{selectedAcc.name}</h1>
                <p style={{ color: T.textDim, fontSize: 12, margin: 0 }}>Last 30 Days</p>
              </div>
              <div style={{ display: "flex", gap: 4, background: T.card, borderRadius: 10, padding: 4 }}>
                {tabs.map(t => (
                  <button key={t.id} onClick={() => setTab(t.id)}
                    style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: tab === t.id ? T.accent : "transparent", color: tab === t.id ? "#fff" : T.textMuted, fontSize: 12, fontWeight: 500, cursor: "pointer", transition: "all 0.15s" }}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Overview */}
            {tab === "overview" && (
              <div className="fade-in">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
                  <StatCard label="Total Spend" value={fmtCurrency(spend)} />
                  <StatCard label="Purchases" value={purchases} color={T.accent} />
                  <StatCard label="ROAS" value={`${roas.toFixed(2)}x`} color={roas >= 4 ? T.green : roas >= 3 ? T.amber : T.red} />
                  <StatCard label="Cost / Purchase" value={fmtCurrency(cpp)} color={cpp > 1500 ? T.red : cpp > 1000 ? T.amber : T.green} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
                  <StatCard label="CTR" value={`${ctr}%`} color={ctr < 1.5 ? T.red : T.text} />
                  <StatCard label="CPM" value={fmtCurrency(cpm)} />
                  <StatCard label="Frequency" value={freq.toFixed(2)} color={freq > 3 ? T.red : freq > 2.5 ? T.amber : T.text} />
                  <StatCard label="Reach" value={fmt(reach)} />
                </div>

                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: T.textMuted }}>Active Campaigns</h3>
                <div style={{ background: T.card, borderRadius: 12, border: `1px solid ${T.border}`, overflow: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                        {["Campaign", "Status", "Spend", "Purchases", "ROAS", "CTR", "Freq"].map(h => (
                          <th key={h} style={{ padding: "12px 14px", textAlign: h === "Campaign" ? "left" : "center", color: T.textDim, fontWeight: 500, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.8 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {campaigns.filter(c => c.insights).sort((a, b) => parseFloat(b.insights?.spend || 0) - parseFloat(a.insights?.spend || 0)).map(c => {
                        const cs = parseFloat(c.insights?.spend || 0);
                        const cp = extractPurchases(c.insights?.actions);
                        const cr = extractROAS(c.insights?.purchase_roas);
                        const cc = parseFloat(c.insights?.ctr || 0);
                        const cf = parseFloat(c.insights?.frequency || 0);
                        return (
                          <tr key={c.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                            <td style={{ padding: "12px 14px", fontWeight: 500, maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</td>
                            <td style={{ textAlign: "center" }}>
                              <span style={{ padding: "3px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600, background: c.status === "ACTIVE" ? T.greenSoft : T.amberSoft, color: c.status === "ACTIVE" ? T.green : T.amber }}>{c.status}</span>
                            </td>
                            <td style={{ textAlign: "center" }}>{fmtCurrency(cs)}</td>
                            <td style={{ textAlign: "center", fontWeight: 600 }}>{cp}</td>
                            <td style={{ textAlign: "center", fontWeight: 700, color: cr >= 4 ? T.green : cr >= 3 ? T.amber : T.red }}>{cr.toFixed(2)}x</td>
                            <td style={{ textAlign: "center", color: cc < 1.5 ? T.red : T.text }}>{cc.toFixed(2)}%</td>
                            <td style={{ textAlign: "center", color: cf > 3 ? T.red : cf > 2.5 ? T.amber : T.text }}>{cf.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Campaigns Health */}
            {tab === "campaigns" && (
              <div className="fade-in">
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: T.textMuted }}>Campaign Health Monitor</h3>
                {campaigns.filter(c => c.insights).sort((a, b) => parseFloat(b.insights?.spend || 0) - parseFloat(a.insights?.spend || 0)).map(c => {
                  const cs = parseFloat(c.insights?.spend || 0);
                  const cp = extractPurchases(c.insights?.actions);
                  const cr = extractROAS(c.insights?.purchase_roas);
                  const cc = parseFloat(c.insights?.ctr || 0);
                  const cf = parseFloat(c.insights?.frequency || 0);
                  const ccpm = parseFloat(c.insights?.cpm || 0);
                  let health = "Healthy", hColor = T.green;
                  if (cf > 3.5 || cr < 2) { health = "Critical"; hColor = T.red; }
                  else if (cf > 2.5 || cr < 3 || cc < 1.5) { health = "Warning"; hColor = T.amber; }

                  return (
                    <div key={c.id} style={{ background: T.card, borderRadius: 12, border: `1px solid ${T.border}`, borderLeft: `4px solid ${hColor}`, padding: "16px 20px", marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{c.name}</p>
                        <span style={{ padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: hColor === T.green ? T.greenSoft : hColor === T.amber ? T.amberSoft : T.redSoft, color: hColor }}>{health}</span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12 }}>
                        {[
                          { l: "Spend", v: fmtCurrency(cs) }, { l: "Purchases", v: cp },
                          { l: "ROAS", v: `${cr.toFixed(2)}x`, c: cr >= 4 ? T.green : cr >= 3 ? T.amber : T.red },
                          { l: "CTR", v: `${cc.toFixed(2)}%`, c: cc < 1.5 ? T.red : T.text },
                          { l: "Frequency", v: cf.toFixed(2), c: cf > 3 ? T.red : cf > 2.5 ? T.amber : T.text },
                          { l: "CPM", v: fmtCurrency(ccpm) },
                        ].map(m => (
                          <div key={m.l}>
                            <p style={{ color: T.textDim, fontSize: 10, margin: "0 0 2px" }}>{m.l}</p>
                            <p style={{ color: m.c || T.text, fontSize: 14, fontWeight: 600, margin: 0 }}>{m.v}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Creative Fatigue */}
            {tab === "fatigue" && (
              <div className="fade-in">
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 6, color: T.textMuted }}>Creative Fatigue Detection</h3>
                <p style={{ color: T.textDim, fontSize: 11, marginBottom: 16 }}>Freq 3.5+ or CTR &lt; 1% = Critical • Freq 2.5+ or CTR &lt; 1.5% or ROAS &lt; 3 = Warning</p>
                {adData.length > 0 ? adData.map((ad, i) => <FatigueAlert key={i} ad={ad} />) : <p style={{ color: T.textDim, fontSize: 13, padding: 40, textAlign: "center" }}>No ad-level data</p>}
              </div>
            )}

            {/* Monthly */}
            {tab === "monthly" && (
              <div className="fade-in">
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: T.textMuted }}>Month-over-Month Comparison</h3>
                <MonthlyChart data={monthlyData} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
