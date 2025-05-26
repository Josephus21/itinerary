const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const SALES_ORDERS_AUTH_TOKEN = process.env.SALES_ORDERS_AUTH_TOKEN;
const TRANSACTION_AUTH_TOKEN = process.env.TRANSACTION_AUTH_TOKEN;

// Check required environment variables early
if (!SALES_ORDERS_AUTH_TOKEN) {
  throw new Error("❌ Missing SALES_ORDERS_AUTH_TOKEN in environment variables.");
}
if (!TRANSACTION_AUTH_TOKEN) {
  throw new Error("❌ Missing TRANSACTION_AUTH_TOKEN in environment variables.");
}

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Simple logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Route: Fetch sales orders
app.post('/api/sales_orders', async (req, res) => {
  const payload = req.body;

  try {
    const response = await fetch('http://gsuite.graphicstar.com.ph/api/get_sales_orders', {
      method: 'POST',
      headers: {
        'Authorization': SALES_ORDERS_AUTH_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `API error with status ${response.status}` });
    }

    const text = await response.text();
    try {
      const data = JSON.parse(text);
      res.json(data);
    } catch (e) {
      console.error("❌ Failed to parse sales_orders JSON:", e);
      res.status(500).json({ error: 'Invalid JSON from sales orders API', raw: text });
    }

  } catch (error) {
    console.error('❌ Error fetching sales orders:', error);
    res.status(500).json({ error: 'Sales orders API request failed' });
  }
});


// Route: Fetch transaction data by so_pk
app.post('/api/get_transaction', async (req, res) => {
  const { so_pk } = req.body;

  if (!so_pk) {
    return res.status(400).json({ error: "Missing 'so_pk' in request body." });
  }

  const transactionPayload = {
    where: {
      Module_TransH: "SALESORDER",
      SysPK_TransH: so_pk,
    },
    include: [
      ["transaction_transactionledgerjobs", "transactionledgerjob_shippingaddress", "transactionledgerjob_location", "transactionledgerjob_job", "transactionledgerjob_transactionjo"],
      "transaction_customer",
      "transaction_shippingaddress",
      "transaction_contactperson",
      "transaction_department",
      "transaction_location",
      "transaction_employee",
      "transaction_transactionsl",
      "transaction_transactionto"
    ],
    order: [[{}, "ID_LdgrJob", "ASC"]],
  };

  try {
    const response = await fetch('http://gsuite.graphicstar.com.ph/api/get_transaction', {
      method: 'POST',
      headers: {
        'Authorization': TRANSACTION_AUTH_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(transactionPayload),
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `Transaction API error with status ${response.status}` });
    }

    const text = await response.text();

    try {
      const data = JSON.parse(text);
      return res.json(data);
    } catch (parseError) {
      console.error("❌ Failed to parse transaction JSON:", parseError);
      return res.status(500).json({ error: 'Invalid JSON from transaction API', raw: text });
    }
  } catch (error) {
    console.error('❌ Error fetching transaction:', error);
    return res.status(500).json({ error: 'Transaction API request failed' });
  }
});

// Serve static frontend files (after API routes)
app.use(express.static(path.join(__dirname, 'public')));

// 404 handler for unmatched routes
app.use((req, res) => {
  res.status(404).send('Route not found');
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
