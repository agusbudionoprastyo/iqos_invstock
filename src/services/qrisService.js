// QRIS Payment Service using Yokke SNAP API v1.0.11
// Updated to match Yokke documentation specifications
import CryptoJS from 'crypto-js';

class QRISService {
  constructor() {
    // API Configuration - Production credentials from Yokke
    this.baseURL = 'https://tst.yokke.co.id:8280/qrissnapmpm/1.0.11'; // Test URL with version 1.0.11
    this.clientKey = 'p_qSZvutLH1xXym6CY6xWYif55oa'; // Client key from Yokke
    this.clientSecret = 'CRWFqBa9tyWbLJIPcmiCsXWvU7ga'; // Secret key from Yokke
    this.merchantId = '463763743'; // Merchant ID from Yokke
    this.terminalId = '12387341'; // Terminal ID from Yokke (8 digits like sample)
    this.partnerId = 'PTKG1'; // Partner ID from documentation
    this.channelId = '02'; // Channel ID from documentation
    this.accessToken = null;
    this.tokenExpiry = null;
    this.generatingQR = false; // Prevent multiple simultaneous calls
  }

  // Generate QR Code for payment (MPM - Merchant Presented Mode)
  async generateQRCode(paymentData) {
    try {
      // Prevent multiple simultaneous calls
      if (this.generatingQR) {
        console.log('QR generation already in progress, skipping...');
        return { success: false, error: 'QR generation already in progress' };
      }
      
      this.generatingQR = true;
      console.log('QRIS Service - Received paymentData:', paymentData);
      console.log('generateQRCode called at:', new Date().toISOString());
      // Ensure we have valid access token
      await this.ensureValidToken();

      const externalId = this.generateExternalId();
      const timestamp = this.getCurrentTimestamp();
      
      // Generate callback URL - use frontend endpoint directly
      const callbackUrl = `${window.location.origin}/payment/callback`;
      
      const payload = {
        merchantId: this.merchantId,
        terminalId: this.terminalId,
        partnerReferenceNo: paymentData.orderId.toString(), // Ensure it's a string
        amount: {
          value: paymentData.amount.toFixed(2),
          currency: 'IDR'
        },
        feeAmount: {
          value: '0.00',
          currency: 'IDR'
        },
        additionalInfo: {
          callbackUrl: callbackUrl
        }
      };
      
      console.log('Partner Reference No:', paymentData.orderId, 'Type:', typeof paymentData.orderId, 'Length:', paymentData.orderId.toString().length);
      console.log('Callback URL:', callbackUrl);

      const requestBody = JSON.stringify(payload);
      console.log('Generate QR Payload:', payload);
      const signature = this.generateSignature('POST', '/v2.0/qr/qr-mpm-generate', requestBody, timestamp);
      console.log('Generated Signature:', signature);
      console.log('Request Body:', requestBody);

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.accessToken}`,
        'X-TIMESTAMP': timestamp,
        'X-SIGNATURE': signature,
        'X-EXTERNAL-ID': externalId,
        'X-PARTNER-ID': this.partnerId,
        'CHANNEL-ID': this.channelId,
        'X-PLATFORM': 'PORTAL'
      };
      
      console.log('Request Headers:', headers);
      
      const response = await fetch(`${this.baseURL}/v2.0/qr/qr-mpm-generate`, {
        method: 'POST',
        headers: headers,
        body: requestBody
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log('Generate QR Error Response:', errorText);
        throw new Error(`QR Generation failed: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Generate QR Response:', result);
      
      if (result.responseCode === '2004700') {
        this.generatingQR = false; // Reset flag on success
        console.log('QR Generation Success - Returning:', {
          success: true,
          qrContent: result.qrContent,
          referenceNo: result.referenceNo,
          partnerReferenceNo: result.partnerReferenceNo,
          terminalId: result.terminalId,
          callbackUrl: callbackUrl
        });
        return {
          success: true,
          qrContent: result.qrContent,
          referenceNo: result.referenceNo,
          partnerReferenceNo: result.partnerReferenceNo,
          terminalId: result.terminalId,
          callbackUrl: callbackUrl
        };
      } else {
        this.generatingQR = false; // Reset flag on error
        throw new Error(`QR Generation failed: ${result.responseMessage}`);
      }
    } catch (error) {
      this.generatingQR = false; // Reset flag on exception
      console.error('QRIS Generation Error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Check payment status (QR Inquiry Status)
  async checkPaymentStatus(referenceNo, originalExternalId, originalTransactionDate) {
    try {
      await this.ensureValidToken();

      const externalId = this.generateExternalId();
      const timestamp = this.getCurrentTimestamp();
      
      console.log('Check Payment Status - Parameters:', {
        referenceNo,
        originalExternalId,
        originalTransactionDate
      });
      
      const payload = {
        originalReferenceNo: referenceNo,
        originalExternalId: originalExternalId,
        serviceCode: '47', // Correct service code from Postman collection
        merchantId: this.merchantId,
        additionalInfo: {
          originalTransactionDate: originalTransactionDate,
          terminalId: this.terminalId
        }
      };

      console.log('Check Payment Status - Payload:', payload);

      const requestBody = JSON.stringify(payload);
      const signature = this.generateSignature('POST', '/v2.0/qr/qr-mpm-query', requestBody, timestamp);

      const response = await fetch(`${this.baseURL}/v2.0/qr/qr-mpm-query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`,
          'X-TIMESTAMP': timestamp,
          'X-SIGNATURE': signature,
          'X-EXTERNAL-ID': externalId,
          'X-PARTNER-ID': this.partnerId,
          'CHANNEL-ID': this.channelId,
          'X-PLATFORM': 'PORTAL'
        },
        body: requestBody
      });

      if (!response.ok) {
        throw new Error(`Status check failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.responseCode === '2005100') {
        return {
          success: true,
          status: result.latestTransactionStatus,
          statusDesc: result.transactionStatusDesc,
          amount: result.amount,
          paidTime: result.paidTime,
          approvalCode: result.additionalInfo?.approvalCode,
          customerName: result.additionalInfo?.customerName,
          issuerName: result.additionalInfo?.issuerName
        };
      } else {
        throw new Error(`Status check failed: ${result.responseMessage}`);
      }
    } catch (error) {
      console.error('Payment Status Check Error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get access token for API authentication
  async getAccessToken() {
    try {
      const timestamp = this.getCurrentTimestamp();
      const signature = this.generateAuthSignature(timestamp);

      const requestBody = JSON.stringify({
        grantType: 'client_credentials'
      });
 
      const response = await fetch(`${this.baseURL}/qr/v2.0/access-token/b2b`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-TIMESTAMP': timestamp,
          'X-CLIENT-KEY': this.clientKey,
          'X-SIGNATURE': signature,
          'X-PLATFORM': 'PORTAL'
        },
        body: requestBody
      });

      if (!response.ok) {
        throw new Error('Authentication failed');
      }

      const result = await response.json();
      
      if (result.responseCode === '2007300') {
        this.accessToken = result.accessToken;
        this.tokenExpiry = Date.now() + (parseInt(result.expiredIn) * 1000);
        return result.accessToken;
      } else {
        throw new Error(`Authentication failed: ${result.responseMessage}`);
      }
    } catch (error) {
      console.error('Authentication Error:', error);
      throw error;
    }
  }

  // Ensure we have a valid access token
  async ensureValidToken() {
    if (!this.accessToken || !this.tokenExpiry || Date.now() >= this.tokenExpiry) {
      await this.getAccessToken();
    }
  }

  // Generate signature for API requests
  generateSignature(method, endpoint, requestBody, timestamp) {
    const stringToSign = `${method}:${endpoint}:${this.accessToken}:${CryptoJS.SHA256(requestBody).toString(CryptoJS.enc.Hex).toLowerCase()}:${timestamp}`;
    const signature = CryptoJS.HmacSHA256(stringToSign, this.clientSecret).toString(CryptoJS.enc.Base64);
    return signature;
  }

  // Generate signature for authentication
  generateAuthSignature(timestamp) {
    const stringToSign = `${this.clientKey}|${timestamp}`;
    // Using HMAC-SHA256 as per documentation
    const signature = CryptoJS.HmacSHA256(stringToSign, this.clientSecret).toString(CryptoJS.enc.Hex);
    return signature;
  }

  // Get current timestamp in ISO format
  getCurrentTimestamp() {
    return new Date().toISOString();
  }

  // Generate external ID (15 digit numeric string)
  generateExternalId() {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return (timestamp + random).slice(-15);
  }

  // Generate order ID (20 characters) - numeric format like sample data
  generateOrderId() {
    // For sandbox testing, use valid test case from documentation
    // Try different test cases to see which one works for status check
    // From documentation: 230218123798000 (success), 230218123798001 (failed), etc.
    // Try test case that might work for both QR generation and status check
    const testCase = '230218123798000';
    console.log('Using test case Order ID:', testCase);
    console.log('generateOrderId called at:', new Date().toISOString());
    return testCase;
  }

  // Format amount for API (remove decimal formatting)
  formatAmount(amount) {
    return parseFloat(amount).toFixed(2);
  }

  // Parse transaction status
  parseTransactionStatus(status) {
    const statusMap = {
      '00': 'Success',
      '01': 'Initiated', 
      '02': 'Paying',
      '03': 'Pending',
      '04': 'Refunded',
      '05': 'Canceled',
      '06': 'Failed',
      '07': 'Not found'
    };
    return statusMap[status] || 'Unknown';
  }

  // Cancel payment (QR Payment Credit Cancel)
  async cancelPayment(originalReferenceNo, originalPartnerReferenceNo, originalExternalId, reason, amount) {
    try {
      await this.ensureValidToken();

      const externalId = this.generateExternalId();
      const timestamp = this.getCurrentTimestamp();
      const originalTransactionDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      
      const payload = {
        originalReferenceNo: originalReferenceNo,
        originalPartnerReferenceNo: originalPartnerReferenceNo,
        originalExternalId: originalExternalId,
        merchantId: this.merchantId,
        reason: reason,
        refundAmount: {
          value: this.formatAmount(amount),
          currency: 'IDR'
        },
        additionalInfo: {
          originalTransactionDate: originalTransactionDate,
          terminalId: this.terminalId,
          originalApprovalCode: '' // Should be provided from original transaction
        }
      };

      const requestBody = JSON.stringify(payload);
      const signature = this.generateSignature('POST', '/v2.0/qr/qr-mpm-cancel', requestBody, timestamp);

      const response = await fetch(`${this.baseURL}/v2.0/qr/qr-mpm-cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`,
          'X-TIMESTAMP': timestamp,
          'X-SIGNATURE': signature,
          'X-EXTERNAL-ID': externalId,
          'X-PARTNER-ID': this.partnerId,
          'CHANNEL-ID': this.channelId,
          'X-PLATFORM': 'PORTAL'
        },
        body: requestBody
      });

      if (!response.ok) {
        throw new Error(`Cancel failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.responseCode === '2007700') {
        return {
          success: true,
          originalReferenceNo: result.originalReferenceNo,
          cancelTime: result.cancelTime,
          approvalCode: result.additionalInfo?.approvalCode
        };
      } else {
        throw new Error(`Cancel failed: ${result.responseMessage}`);
      }
    } catch (error) {
      console.error('Payment Cancel Error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Create singleton instance
const qrisService = new QRISService();

export default qrisService;
