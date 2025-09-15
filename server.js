require("dotenv").config();
const express = require("express");
const fetch = require("node-fetch");

const app = express();

const SHOP = process.env.SHOPIFY_SHOP;
const ADMIN_API_TOKEN = process.env.ADMIN_API_TOKEN;

app.get("/", (req, res) => {
  res.send("Shopify Tracking API is running!");
});

app.get("/orders", async (req, res) => {
  try {
    const response = await fetch(
      `https://${SHOP}/admin/api/2023-10/orders.json`,
      {
        headers: {
          "X-Shopify-Access-Token": ADMIN_API_TOKEN,
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
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
