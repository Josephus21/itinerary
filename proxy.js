const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const USERNAME = process.env.API_USERNAME;
const PASSWORD = process.env.API_PASSWORD;

if (!USERNAME || !PASSWORD) {
  throw new Error('❌ Missing API_USERNAME or API_PASSWORD in env variables.');
}

let currentToken = null;
let tokenExpiry = 0; // timestamp in ms

async function loginAndGetToken() {
  try {
    const res = await fetch('http://gsuite.graphicstar.com.ph/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
    });

    if (!res.ok) {
      throw new Error(`Login failed with status ${res.status}`);
    }

    const data = await res.json();
console.log('Login response data:', data);  // for debugging

const token = data.data?.token;
if (!token) throw new Error('No token in login response');

tokenExpiry = Date.now() + 50 * 60 * 1000;  // or adjust as needed
currentToken = token;
console.log('✅ Logged in, token refreshed');

  } catch (error) {
    console.error('❌ Error logging in:', error);
    throw error;
  }
}


async function getValidToken() {
  if (!currentToken || Date.now() >= tokenExpiry) {
    await loginAndGetToken();
  }
  return currentToken;
}

// Middleware and routes
app.use(cors());
app.use(express.json());

app.post('/api/sales_orders', async (req, res) => {
  try {
    const token = await getValidToken();
    const response = await fetch('http://gsuite.graphicstar.com.ph/api/get_sales_orders', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `API error with status ${response.status}` });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('❌ Error fetching sales orders:', error);
    res.status(500).json({ error: 'Sales orders API request failed' });
  }
});

app.post('/api/get_transaction', async (req, res) => {
  try {
    const token = await getValidToken();

    // Build your transaction payload here (use req.body or similar)
    const transactionPayload = req.body;

    const response = await fetch('http://gsuite.graphicstar.com.ph/api/get_transaction', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(transactionPayload),
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `Transaction API error with status ${response.status}` });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('❌ Error fetching transaction:', error);
    res.status(500).json({ error: 'Transaction API request failed' });
  }
});

// Serve static files and 404
app.use(express.static(path.join(__dirname, 'public')));
app.use((req, res) => res.status(404).send('Route not found'));

// Start server and login initially
app.listen(PORT, async () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
  try {
    await loginAndGetToken();
  } catch (err) {
    console.error('❌ Initial login failed. Server may not function correctly.');
  }
});
