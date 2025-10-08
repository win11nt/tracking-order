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

app.get("/ping", (req, res) => {
  res.json({ message: "pong", time: new Date().toISOString() });
});

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
    return res
      .status(400)
      .json({ error: "order_id and email/phone are required" });
  }

  try {
    const cleanName = order_id.replace("#", "").trim();

    const headers = {
      "X-Shopify-Access-Token": SHOPIFY_TOKEN,
      "Content-Type": "application/json",
    };

    // ---- 1️⃣ Tìm trong 250 đơn mới nhất ----
    const listUrl = `https://${SHOP}/admin/api/2023-10/orders.json?status=any&limit=250`;
    const listRes = await fetch(listUrl, { headers });

    if (!listRes.ok)
      throw new Error(`Shopify API error: ${listRes.statusText}`);

    const { orders } = await listRes.json();
    let order =
      orders.find((o) => o.name.replace("#", "") === cleanName) ||
      orders.find((o) => o.order_status_url?.includes(cleanName));

    // ---- 2️⃣ Nếu không tìm thấy, thử gọi trực tiếp /orders/{id}.json ----
    if (!order) {
      const directUrl = `https://${SHOP}/admin/api/2023-10/orders/${cleanName}.json`;
      const directRes = await fetch(directUrl, { headers });

      if (directRes.ok) {
        const directData = await directRes.json();
        order = directData.order;
      }
    }

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // ---- 3️⃣ Chuẩn hóa email/sđt nhập vào ----
    const input = email.toLowerCase().replace(/\s+/g, "");
    const orderEmail = order.email?.toLowerCase() || "";
    const orderPhone = order.phone?.replace(/\D/g, "");
    const inputPhoneDigits = input.replace(/\D/g, "");

    const emailMatch = input && orderEmail === input;
    const phoneMatch =
      inputPhoneDigits && orderPhone && orderPhone.endsWith(inputPhoneDigits);

    if (!emailMatch && !phoneMatch) {
      return res
        .status(403)
        .json({ error: "Email or phone does not match order" });
    }

    // ---- 4️⃣ Trả về dữ liệu tracking ----
    const timeline = {
      order_id: order.name,
      email: order.email,
      phone: order.phone,
      financial_status: order.financial_status,
      fulfillment_status: order.fulfillment_status || "unfulfilled",
      placed_at: order.created_at,
      shipped_at: order.fulfillments?.[0]?.created_at || null,
      tracking_number: order.fulfillments?.[0]?.tracking_number || null,
      tracking_url: order.fulfillments?.[0]?.tracking_url || null,
      order_status_url: order.order_status_url,
    };

    res.json(timeline);
  } catch (error) {
    console.error("Track-order error:", error);
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
