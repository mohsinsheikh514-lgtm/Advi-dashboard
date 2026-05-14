export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get("endpoint") || "orders";
  const params = searchParams.get("params") || "";
  
  const store = process.env.NEXT_PUBLIC_SHOPIFY_STORE;
  const token = process.env.SHOPIFY_ACCESS_TOKEN;

  if (!store || !token) {
    return Response.json({ error: "Shopify not configured" }, { status: 400 });
  }

  const baseUrl = `https://${store}/admin/api/2024-01`;
  
  try {
    let url;
    switch (endpoint) {
      case "orders":
        url = `${baseUrl}/orders.json?status=any&limit=250&${params}`;
        break;
      case "orders_count":
        url = `${baseUrl}/orders/count.json?${params}`;
        break;
      case "products":
        url = `${baseUrl}/products.json?limit=250&${params}`;
        break;
      case "products_count":
        url = `${baseUrl}/products/count.json`;
        break;
      case "customers_count":
        url = `${baseUrl}/customers/count.json`;
        break;
      case "inventory":
        url = `${baseUrl}/inventory_levels.json?${params}`;
        break;
      default:
        url = `${baseUrl}/${endpoint}.json?${params}`;
    }

    const r = await fetch(url, {
      headers: {
        "X-Shopify-Access-Token": token,
        "Content-Type": "application/json",
      },
    });

    const data = await r.json();
    
    if (r.status !== 200) {
      return Response.json({ error: data.errors || "Shopify API error" }, { status: r.status });
    }

    return Response.json(data);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
