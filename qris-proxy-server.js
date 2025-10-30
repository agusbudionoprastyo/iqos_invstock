// Backend QRIS Proxy Server (Node.js/Express)
// This proxy handles QRIS API calls to avoid CORS issues from browser

import express from 'express';
import cors from 'cors';
import https from 'https';

const app = express();

// Enable CORS for frontend
app.use(cors({
  origin: true, // Allow all origins (adjust for production)
  credentials: true
}));
app.use(express.json());

// Yokke API Configuration
const YOKKE_BASE_URL = 'https://tst.yokke.co.id:8280';
const YOKKE_TST_URL = 'https://tst.yokke.co.id:8280/qrissnapmpm/1.0.11';

// Helper function to make request to Yokke API
async function forwardRequest(method, endpoint, headers, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, YOKKE_BASE_URL);
    
    console.log(`[Forward Request] ${method} ${url.toString()}`);
    console.log(`[Headers]`, headers);
    if (body) {
      console.log(`[Body]`, JSON.stringify(body));
    }
    
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: method,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        // Add headers to mimic Postman and avoid Imperva HTML challenge
        'Accept-Encoding': 'identity',
        'Connection': 'keep-alive',
        'User-Agent': headers['User-Agent'] || headers['user-agent'] || 'PostmanRuntime/7.40.0',
        'Host': `${url.hostname}:${url.port || 443}`
      },
      rejectUnauthorized: false // For self-signed certs in dev (remove in production)
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`[Response] Status: ${res.statusCode}`);
        console.log(`[Response Body]`, data.substring(0, 500)); // Log first 500 chars
        
        try {
          const response = {
            status: res.statusCode,
            headers: res.headers,
            body: data ? JSON.parse(data) : null,
            rawBody: data
          };
          resolve(response);
        } catch (error) {
          console.error(`[Response Parse Error]`, error);
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: null,
            rawBody: data
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

// Proxy endpoint for access token
app.post('/api/qris/auth', async (req, res) => {
  try {
    console.log('Auth request received:', { body: req.body, headers: req.headers });
    const { timestamp, clientKey, signature, requestBody: requestBodyStr } = req.body;
    
    if (!timestamp || !clientKey || !signature) {
      console.error('Missing required fields:', { timestamp, clientKey, signature });
      return res.status(400).json({ error: 'Missing required fields: timestamp, clientKey, signature' });
    }
    
    const headers = {
      'Content-Type': 'application/json',
      'X-TIMESTAMP': timestamp,
      'X-CLIENT-KEY': clientKey,
      'X-SIGNATURE': signature,
      'X-PLATFORM': 'PORTAL'
    };

    // Use the request body from client (or default)
    const body = requestBodyStr ? JSON.parse(requestBodyStr) : {
      grantType: 'client_credentials'
    };

    console.log('Forwarding auth request to Yokke...');
    console.log('Auth Signature:', signature);
    console.log('Auth Timestamp:', timestamp);
    console.log('Auth Body:', body);
    
    // Use fixed TST endpoint as per Postman collection
    const response = await forwardRequest(
      'POST',
      '/qrissnapmpm/1.0.11/qr/v2.0/access-token/b2b',
      headers,
      body
    );
    
    console.log('Yokke auth response:', { status: response.status, body: response.body });
    
    if (response.body) {
      res.status(response.status).json(response.body);
    } else {
      res.status(response.status).json({ raw: response.rawBody });
    }
  } catch (error) {
    console.error('Auth Proxy Error:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// Proxy endpoint for generate QR
app.post('/api/qris/generate', async (req, res) => {
  try {
    console.log('Generate QR request received');
    const { headers: requestHeaders, body: requestBody } = req.body;
    
    if (!requestHeaders || !requestBody) {
      console.error('Missing required fields:', { hasHeaders: !!requestHeaders, hasBody: !!requestBody });
      return res.status(400).json({ error: 'Missing required fields: headers, body' });
    }
    
    console.log('Forwarding generate QR request to Yokke...');
    const response = await forwardRequest(
      'POST',
      '/qrissnapmpm/1.0.11/v2.0/qr/qr-mpm-generate',
      requestHeaders,
      requestBody
    );
    
    console.log('Yokke generate QR response:', { status: response.status });
    
    if (response.body) {
      res.status(response.status).json(response.body);
    } else {
      res.status(response.status).json({ raw: response.rawBody });
    }
  } catch (error) {
    console.error('Generate QR Proxy Error:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// Proxy endpoint for check payment status
app.post('/api/qris/status', async (req, res) => {
  try {
    const { headers: requestHeaders, body: requestBody } = req.body;
    
    const response = await forwardRequest(
      'POST',
      '/qrissnapmpm/1.0.11/v2.0/qr/qr-mpm-query',
      requestHeaders,
      requestBody
    );
    
    res.status(response.status).json(response.body || { raw: response.rawBody });
  } catch (error) {
    console.error('Status Check Proxy Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Proxy endpoint for cancel/refund payment
app.post('/api/qris/cancel', async (req, res) => {
  try {
    const { headers: requestHeaders, body: requestBody } = req.body;
    
    const response = await forwardRequest(
      'POST',
      '/qrissnapmpm/1.0.11/v2.0/qr/qr-mpm-cancel',
      requestHeaders,
      requestBody
    );
    
    res.status(response.status).json(response.body || { raw: response.rawBody });
  } catch (error) {
    console.error('Cancel Payment Proxy Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Test endpoint
app.get('/api/qris/test', (req, res) => {
  res.status(200).json({ 
    message: 'QRIS Proxy Server is running!',
    timestamp: new Date().toISOString(),
    yokkeBaseUrl: YOKKE_BASE_URL
  });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`QRIS Proxy Server running on port ${PORT}`);
  console.log(`Proxying to: ${YOKKE_BASE_URL}`);
});

export default app;

