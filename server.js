import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();

// Cho phép CORS từ tất cả domain (test)
app.use(cors());

// Nếu muốn chỉ cho phép domain shop
// app.use(cors({ origin: "https://gottaprints.com" }));

app.use(express.json());

const SHOP = process.env.SHOPIFY_SHOP; // ví dụ: gottaprints.myshopify.com
const SHOPIFY_TOKEN = process.env.SHOPIFY_TOKEN;

console.log("SHOP =", SHOP);
console.log("SHOPIFY_TOKEN=", SHOPIFY_TOKEN ? "Loaded" : "Missing");

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
          "X-Shopify-Access-Token": SHOPIFY_TOKEN,
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

// endpoint track đơn theo id hoặc name
app.get("/track-order", async (req, res) => {
  const { order_id, email } = req.query;

  if (!order_id || !email) {
    return res.status(400).json({ error: "order_id and email are required" });
  }

  try {
    let apiUrl;

    // Nếu order_id dài (ID Shopify), gọi theo /orders/{id}.json
    if (/^\d{10,}$/.test(order_id)) {
      apiUrl = `https://${SHOP}/admin/api/2023-10/orders/${order_id}.json`;
    } else {
      // Nếu là order name (#1001 → 1001), gọi theo name
      const cleanName = order_id.replace("#", "");
      apiUrl = `https://${SHOP}/admin/api/2023-10/orders.json?status=any&name=${cleanName}`;
    }

    const response = await fetch(apiUrl, {
      headers: {
        "X-Shopify-Access-Token": SHOPIFY_TOKEN,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Shopify API error: ${text}`);
    }

    const data = await response.json();

    // Nếu gọi bằng ID thì data có dạng { order: {...} }
    // Nếu gọi bằng name thì data có dạng { orders: [...] }
    const order = data.order || data.orders?.[0];

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // check email khớp
    if (order.email?.toLowerCase() !== email.toLowerCase()) {
      return res.status(403).json({ error: "Email does not match order" });
    }

    // timeline trả về
    const timeline = {
      order_id: order.name,
      email: order.email,
      financial_status: order.financial_status,
      fulfillment_status: order.fulfillment_status || "unfulfilled",
      placed_at: order.created_at,
      shipped_at: order.fulfillments?.[0]?.created_at || null,
      tracking_number: order.fulfillments?.[0]?.tracking_number || null,
      tracking_url: order.fulfillments?.[0]?.tracking_url || null,
      order_status_url: order.order_status_url, // 👈 cái này Shopify trả về
    };

    res.json(timeline);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/test-order", async (req, res) => {
  try {
    const orderId = "6365486809282"; // test cứng
    const response = await fetch(
      `https://${SHOP}/admin/api/2023-10/orders/${orderId}.json`,
      {
        headers: {
          "X-Shopify-Access-Token": SHOPIFY_TOKEN,
          "Content-Type": "application/json",
        },
      }
    );
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
