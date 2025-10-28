// Backend QRIS Callback Endpoint (Node.js/Express example)
// This file is for reference - implement this on your backend server

const express = require('express');
const crypto = require('crypto');
const qrisCallbackService = require('./qrisCallbackService');

const app = express();
app.use(express.json());

// QRIS Payment Callback Endpoint
app.post('/qr/qr-mpm-notify', async (req, res) => {
  try {
    console.log('QRIS Callback received:', req.body);
    
    // Extract headers
    const timestamp = req.headers['x-timestamp'];
    const signature = req.headers['x-signature'];
    const externalId = req.headers['x-external-id'];
    const partnerId = req.headers['x-partner-id'];
    const channelId = req.headers['channel-id'];

    // Verify required headers
    if (!timestamp || !signature || !externalId || !partnerId || !channelId) {
      return res.status(400).json({
        responseCode: '4005200',
        responseMessage: 'Missing required headers'
      });
    }

    // Process the callback
    const result = await qrisCallbackService.handleCallbackRequest(req);

    // Return response to Yokke
    res.status(200).json({
      responseCode: result.responseCode,
      responseMessage: result.responseMessage,
      timestamp: result.timestamp
    });

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
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`QRIS Callback Server running on port ${PORT}`);
});

module.exports = app;
