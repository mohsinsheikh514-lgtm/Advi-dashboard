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
    `${API_BASE}/${accountId}/insights?fields=spend,impressions,reach,clicks,ctr,cpm,cpc,actions,purchase_roas,frequency,cost_per_action_type,action_values&time_range=${JSON.stringify(dateRange)}&access_token=${token}`
  );
  const d = await r.json();
  return d.data?.[0] || null;
}

export async function fetchDailyInsights(accountId, token, dateRange) {
  const r = await fetch(
    `${API_BASE}/${accountId}/insights?fields=spend,actions,purchase_roas,impressions,clicks,ctr,frequency&time_range=${JSON.stringify(dateRange)}&time_increment=1&access_token=${token}`
  );
  const d = await r.json();
  return d.data || [];
}

export async function fetchFunnelData(accountId, token, dateRange) {
  const r = await fetch(
    `${API_BASE}/${accountId}/insights?fields=impressions,actions,action_values&time_range=${JSON.stringify(dateRange)}&access_token=${token}`
  );
  const d = await r.json();
  const data = d.data?.[0];
  if (!data) return null;

  const getAction = (type) => {
    const a = data.actions?.find(x => x.action_type === type);
    return a ? parseInt(a.value) : 0;
  };

  return {
    impressions: parseInt(data.impressions || 0),
    link_clicks: getAction("link_click"),
    landing_page_views: getAction("landing_page_view"),
    add_to_cart: getAction("add_to_cart"),
    initiate_checkout: getAction("initiate_checkout"),
    purchases: getAction("omni_purchase") || getAction("purchase"),
  };
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
          `${API_BASE}/${c.id}/insights?fields=spend,impressions,reach,clicks,ctr,cpm,cpc,actions,purchase_roas,frequency,cost_per_action_type,action_values&time_range=${JSON.stringify(dateRange)}&access_token=${token}`
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

export async function fetchCampaignAdsets(campaignId, token, dateRange) {
  const r = await fetch(
    `${API_BASE}/${campaignId}/adsets?fields=id,name,status,daily_budget,targeting&limit=20&access_token=${token}`
  );
  const d = await r.json();
  const adsets = d.data || [];

  const withInsights = await Promise.all(
    adsets.map(async (as) => {
      try {
        const ir = await fetch(
          `${API_BASE}/${as.id}/insights?fields=spend,impressions,reach,clicks,ctr,cpm,actions,purchase_roas,frequency&time_range=${JSON.stringify(dateRange)}&access_token=${token}`
        );
        const id = await ir.json();
        return { ...as, insights: id.data?.[0] || null };
      } catch {
        return { ...as, insights: null };
      }
    })
  );
  return withInsights;
}

export async function fetchAdInsights(accountId, token, dateRange) {
  const r = await fetch(
    `${API_BASE}/${accountId}/insights?fields=ad_id,ad_name,adset_name,campaign_name,spend,impressions,reach,clicks,ctr,cpm,actions,purchase_roas,frequency,action_values,video_p25_watched_actions,video_p75_watched_actions,video_thruplay_watched_actions,cost_per_action_type&level=ad&time_range=${JSON.stringify(dateRange)}&sort=spend_descending&limit=30&access_token=${token}`
  );
  const d = await r.json();
  return d.data || [];
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
          `${API_BASE}/${accountId}/insights?fields=spend,impressions,reach,actions,purchase_roas,frequency,ctr,cpm,action_values&time_range={"since":"${r.since}","until":"${r.until}"}&access_token=${token}`
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

export async function fetchPlacementBreakdown(accountId, token, dateRange) {
  const r = await fetch(
    `${API_BASE}/${accountId}/insights?fields=spend,impressions,clicks,actions,purchase_roas,ctr,cpm&breakdowns=publisher_platform,platform_position&time_range=${JSON.stringify(dateRange)}&limit=20&access_token=${token}`
  );
  const d = await r.json();
  return d.data || [];
}

export async function fetchAgeGenderBreakdown(accountId, token, dateRange) {
  const r = await fetch(
    `${API_BASE}/${accountId}/insights?fields=spend,impressions,clicks,actions,purchase_roas&breakdowns=age,gender&time_range=${JSON.stringify(dateRange)}&limit=30&access_token=${token}`
  );
  const d = await r.json();
  return d.data || [];
}

export async function fetchDeviceBreakdown(accountId, token, dateRange) {
  const r = await fetch(
    `${API_BASE}/${accountId}/insights?fields=spend,impressions,clicks,actions,purchase_roas,ctr,cpm&breakdowns=device_platform&time_range=${JSON.stringify(dateRange)}&limit=10&access_token=${token}`
  );
  const d = await r.json();
  return d.data || [];
}

// ─── Helpers ───
export function extractPurchases(actions) {
  if (!actions) return 0;
  const p = actions.find(a => a.action_type === "omni_purchase" || a.action_type === "purchase");
  return p ? parseInt(p.value) : 0;
}

export function extractActionValue(actions, type) {
  if (!actions) return 0;
  const a = actions.find(x => x.action_type === type);
  return a ? parseInt(a.value) : 0;
}

export function extractROAS(roas) {
  if (!roas) return 0;
  return parseFloat(roas[0]?.value || 0);
}

export function extractRevenue(actionValues) {
  if (!actionValues) return 0;
  const p = actionValues.find(a => a.action_type === "omni_purchase" || a.action_type === "purchase");
  return p ? parseFloat(p.value) : 0;
}

export function fmt(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n?.toFixed?.(0) ?? "0";
}

export function fmtCurrency(n, c = "PKR") {
  return `${c} ${fmt(n)}`;
}

export function fmtFull(n) {
  return new Intl.NumberFormat().format(Math.round(n));
}

export function getDateRange(preset, customFrom, customTo) {
  const now = new Date();
  const today = now.toISOString().split("T")[0];

  const daysAgo = (d) => {
    const date = new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
    return date.toISOString().split("T")[0];
  };

  const monthStart = (offset = 0) => {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    return d.toISOString().split("T")[0];
  };

  const monthEnd = (offset = 0) => {
    const d = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
    return d.toISOString().split("T")[0];
  };

  switch (preset) {
    case "today": return { since: today, until: today };
    case "yesterday": return { since: daysAgo(1), until: daysAgo(1) };
    case "7d": return { since: daysAgo(7), until: today };
    case "14d": return { since: daysAgo(14), until: today };
    case "30d": return { since: daysAgo(30), until: today };
    case "90d": return { since: daysAgo(90), until: today };
    case "this_month": return { since: monthStart(0), until: today };
    case "last_month": return { since: monthStart(-1), until: monthEnd(-1) };
    case "custom": return { since: customFrom || daysAgo(30), until: customTo || today };
    default: return { since: daysAgo(30), until: today };
  }
}

export function getPreviousPeriod(dateRange) {
  const start = new Date(dateRange.since);
  const end = new Date(dateRange.until);
  const diff = Math.ceil((end - start) / (24 * 60 * 60 * 1000)) + 1;
  const prevEnd = new Date(start.getTime() - 24 * 60 * 60 * 1000);
  const prevStart = new Date(prevEnd.getTime() - (diff - 1) * 24 * 60 * 60 * 1000);
  return {
    since: prevStart.toISOString().split("T")[0],
    until: prevEnd.toISOString().split("T")[0],
  };
}
