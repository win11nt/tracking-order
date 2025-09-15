import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();

const SHOP = process.env.SHOPIFY_SHOP; // ví dụ: gottaprints.myshopify.com
const ADMIN_API_TOKEN = process.env.ADMIN_API_TOKEN;

console.log("SHOP =", SHOP);
console.log("ADMIN_API_TOKEN=", ADMIN_API_TOKEN ? "Loaded" : "Missing");

// test route
app.get("/", (req, res) => {
  res.send("Shopify Tracking API is running!");
});

// lấy tất cả orders
app.get("/orders", async (req, res) => {
  try {
    const response = await fetch(
      `https://${SHOP}/admin/api/2023-10/orders.json?status=any&limit=5`, // limit để test
      {
        headers: {
          "X-Shopify-Access-Token": ADMIN_API_TOKEN,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Shopify API error: ${text}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// endpoint track đơn theo id
app.get("/track-order", async (req, res) => {
  const { order_id, email } = req.query;

  if (!order_id || !email) {
    return res.status(400).json({ error: "order_id and email are required" });
  }

  try {
    // gọi API Shopify tìm đơn theo ID + email
    const response = await fetch(
      `https://${SHOP}/admin/api/2023-10/orders.json?status=any&name=${order_id}&email=${email}`,
      {
        headers: {
          "X-Shopify-Access-Token": ADMIN_API_TOKEN,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Shopify API error: ${text}`);
    }

    const data = await response.json();
    if (!data.orders || data.orders.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    const order = data.orders[0]; // lấy đơn đầu tiên khớp

    // timeline cơ bản
    const timeline = {
      order_id: order.name,
      email: order.email,
      financial_status: order.financial_status, // paid, pending...
      fulfillment_status: order.fulfillment_status || "unfulfilled", // shipped/delivered
      placed_at: order.created_at,
      shipped_at: order.fulfillments?.[0]?.created_at || null,
      delivered_at:
        order.fulfillments?.[0]?.tracking_info?.delivered_at || null,
      tracking_number: order.fulfillments?.[0]?.tracking_number || null,
      tracking_url: order.fulfillments?.[0]?.tracking_url || null,
    };

    res.json(timeline);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
