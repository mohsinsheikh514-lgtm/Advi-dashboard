const API_BASE = "https://graph.facebook.com/v21.0";

export async function fetchAccounts(token) {
  const r = await fetch(
    `${API_BASE}/me/adaccounts?fields=id,name,account_status,currency,amount_spent&limit=50&access_token=${token}`
  );
  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
  return (d.data || []).filter(a => a.account_status === 1 || a.account_status === 2);
}

export async function fetchAccountInsights(accountId, token, dateRange) {
  const r = await fetch(
    `${API_BASE}/${accountId}/insights?fields=spend,impressions,reach,clicks,ctr,cpm,cpc,actions,purchase_roas,frequency&time_range=${JSON.stringify(dateRange)}&access_token=${token}`
  );
  const d = await r.json();
  return d.data?.[0] || null;
}

export async function fetchCampaigns(accountId, token, dateRange) {
  const r = await fetch(
    `${API_BASE}/${accountId}/campaigns?fields=id,name,status,daily_budget,objective&filtering=[{"field":"effective_status","operator":"IN","value":["ACTIVE","PAUSED"]}]&limit=25&access_token=${token}`
  );
  const d = await r.json();
  const campaigns = d.data || [];

  const withInsights = await Promise.all(
    campaigns.slice(0, 15).map(async (c) => {
      try {
        const ir = await fetch(
          `${API_BASE}/${c.id}/insights?fields=spend,impressions,reach,clicks,ctr,cpm,cpc,actions,purchase_roas,frequency,cost_per_action_type&time_range=${JSON.stringify(dateRange)}&access_token=${token}`
        );
        const id = await ir.json();
        return { ...c, insights: id.data?.[0] || null };
      } catch {
        return { ...c, insights: null };
      }
    })
  );
  return withInsights;
}

export async function fetchMonthlyInsights(accountId, token, months = 4) {
  const ranges = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const actual_end = end > now ? now : end;
    ranges.push({
      label: d.toLocaleString("default", { month: "short", year: "2-digit" }),
      since: d.toISOString().split("T")[0],
      until: actual_end.toISOString().split("T")[0],
    });
  }

  const results = await Promise.all(
    ranges.map(async (r) => {
      try {
        const res = await fetch(
          `${API_BASE}/${accountId}/insights?fields=spend,impressions,reach,actions,purchase_roas,frequency,ctr,cpm&time_range={"since":"${r.since}","until":"${r.until}"}&access_token=${token}`
        );
        const d = await res.json();
        return { ...r, data: d.data?.[0] || null };
      } catch {
        return { ...r, data: null };
      }
    })
  );
  return results;
}

export async function fetchAdInsights(accountId, token, dateRange) {
  const r = await fetch(
    `${API_BASE}/${accountId}/insights?fields=ad_id,ad_name,spend,impressions,reach,clicks,ctr,cpm,actions,purchase_roas,frequency&level=ad&time_range=${JSON.stringify(dateRange)}&sort=spend_descending&limit=20&access_token=${token}`
  );
  const d = await r.json();
  return d.data || [];
}

export function extractPurchases(actions) {
  if (!actions) return 0;
  const p = actions.find(a => a.action_type === "omni_purchase" || a.action_type === "purchase");
  return p ? parseInt(p.value) : 0;
}

export function extractROAS(roas) {
  if (!roas) return 0;
  return parseFloat(roas[0]?.value || 0);
}

export function fmt(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n?.toFixed?.(0) ?? "0";
}

export function fmtCurrency(n, c = "PKR") {
  return `${c} ${fmt(n)}`;
}
