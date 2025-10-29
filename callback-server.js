// Simple QRIS Callback Server for Testing
// Run with: node callback-server.js

const express = require('express');
const cors = require('cors');
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// QRIS Payment Callback Endpoint
app.post('/api/qris/callback', async (req, res) => {
  try {
    console.log('=== QRIS CALLBACK RECEIVED ===');
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);
    console.log('================================');
    
    // Extract headers
    const timestamp = req.headers['x-timestamp'];
    const signature = req.headers['x-signature'];
    const externalId = req.headers['x-external-id'];
    const partnerId = req.headers['x-partner-id'];
    const channelId = req.headers['channel-id'];

    // Log all received data
    console.log('Extracted Headers:');
    console.log('- X-TIMESTAMP:', timestamp);
    console.log('- X-SIGNATURE:', signature);
    console.log('- X-EXTERNAL-ID:', externalId);
    console.log('- X-PARTNER-ID:', partnerId);
    console.log('- CHANNEL-ID:', channelId);

    // For testing, we'll always return success
    // In production, you should verify the signature and process the payment
    
    const response = {
      responseCode: '2005200',
      responseMessage: 'Callback processed successfully',
      timestamp: new Date().toISOString()
    };

    console.log('Sending response:', response);
    
    res.status(200).json(response);

  } catch (error) {
    console.error('QRIS Callback Error:', error);
    res.status(500).json({
      responseCode: '5005200',
      responseMessage: 'Internal Server Error'
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'QRIS Callback Server is running'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({ 
    message: 'QRIS Callback Server',
    endpoints: {
      callback: 'POST /api/qris/callback',
      health: 'GET /health'
    }
  });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 QRIS Callback Server running on port ${PORT}`);
  console.log(`📡 Callback URL: http://localhost:${PORT}/api/qris/callback`);
  console.log(`❤️  Health check: http://localhost:${PORT}/health`);
  console.log('');
  console.log('To test the callback, you can use:');
  console.log(`curl -X POST http://localhost:${PORT}/api/qris/callback \\`);
  console.log('  -H "Content-Type: application/json" \\');
  console.log('  -H "X-TIMESTAMP: 20250129120000" \\');
  console.log('  -H "X-SIGNATURE: test-signature" \\');
  console.log('  -H "X-EXTERNAL-ID: test-external-id" \\');
  console.log('  -H "X-PARTNER-ID: PTKG1" \\');
  console.log('  -H "CHANNEL-ID: 02" \\');
  console.log('  -d \'{"test": "data"}\'');
});

module.exports = app;
