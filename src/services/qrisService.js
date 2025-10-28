// QRIS Payment Service using Yokke SNAP API
import CryptoJS from 'crypto-js';

class QRISService {
  constructor() {
    // API Configuration - replace with actual credentials
    // this.baseURL = 'https://api.yokke.co.id:7778'; // Production URL
    this.baseURL = 'https://dev.yokke.co.id:7778'; // Development URL
    // this.baseURL = 'https://tst.yokke.co.id:7778'; // Test URL
    this.clientKey = 'YOUR_CLIENT_KEY'; // X-CLIENT-KEY from registration
    this.clientSecret = 'YOUR_CLIENT_SECRET'; // Client secret for signature
    this.merchantId = '00007100010926'; // Example merchant ID
    this.terminalId = '72001126'; // Example terminal ID
    this.partnerId = 'MTI-STORE'; // Partner identifier
    this.channelId = '02'; // POS channel
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  // Generate QR Code for payment (MPM - Merchant Presented Mode)
  async generateQRCode(paymentData) {
    try {
      // Ensure we have valid access token
      await this.ensureValidToken();

      const externalId = this.generateExternalId();
      const timestamp = this.getCurrentTimestamp();
      
      const payload = {
        merchantId: this.merchantId,
        terminalId: this.terminalId,
        partnerReferenceNo: paymentData.orderId,
        amount: {
          value: paymentData.amount.toFixed(2),
          currency: 'IDR'
        },
        feeAmount: {
          value: '0.00',
          currency: 'IDR'
        },
        additionalInfo: {
          memberBank: '999', // Default bank code
          callbackUrl: `${window.location.origin}/payment/callback` // Callback URL for payment notifications
        }
      };

      const requestBody = JSON.stringify(payload);
      const signature = this.generateSignature('POST', '/v2.0/qr/qr-mpm-generate', requestBody, timestamp);

      const response = await fetch(`${this.baseURL}/v2.0/qr/qr-mpm-generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`,
          'X-TIMESTAMP': timestamp,
          'X-SIGNATURE': signature,
          'X-EXTERNAL-ID': externalId,
          'X-PARTNER-ID': this.partnerId,
          'CHANNEL-ID': this.channelId
        },
        body: requestBody
      });

      if (!response.ok) {
        throw new Error(`QR Generation failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.responseCode === '2004700') {
        return {
          success: true,
          qrContent: result.qrContent,
          referenceNo: result.referenceNo,
          partnerReferenceNo: result.partnerReferenceNo,
          terminalId: result.terminalId
        };
      } else {
        throw new Error(`QR Generation failed: ${result.responseMessage}`);
      }
    } catch (error) {
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
      
      const payload = {
        originalReferenceNo: referenceNo,
        originalExternalId: originalExternalId,
        serviceCode: '47', // QR Generation service code
        merchantId: this.merchantId,
        additionalInfo: {
          originalTransactionDate: originalTransactionDate,
          terminalId: this.terminalId,
          memberBank: '999'
        }
      };

      const requestBody = JSON.stringify(payload);
      const signature = this.generateSignature('POST', '/v3.0/qr/qr-mpm-query', requestBody, timestamp);

      const response = await fetch(`${this.baseURL}/v3.0/qr/qr-mpm-query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`,
          'X-TIMESTAMP': timestamp,
          'X-SIGNATURE': signature,
          'X-EXTERNAL-ID': externalId,
          'X-PARTNER-ID': this.partnerId,
          'CHANNEL-ID': this.channelId
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

      const response = await fetch(`${this.baseURL}/qr/v2.0/access-token/b2b`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-TIMESTAMP': timestamp,
          'X-CLIENT-KEY': this.clientKey,
          'X-SIGNATURE': signature
        },
        body: JSON.stringify({
          grantType: 'client_credentials'
        })
      });

      if (!response.ok) {
        throw new Error('Authentication failed');
      }

      const result = await response.json();
      
      if (result.responseCode === '2007300') {
        this.accessToken = result.accessToken;
        this.tokenExpiry = Date.now() + (parseInt(result.expiresIn) * 1000);
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
    const signature = CryptoJS.HmacSHA512(stringToSign, this.clientSecret).toString(CryptoJS.enc.Base64);
    return signature;
  }

  // Generate signature for authentication
  generateAuthSignature(timestamp) {
    const stringToSign = `${this.clientKey}|${timestamp}`;
    // Note: This should use RSA-SHA256 with private key in production
    // For now, using HMAC-SHA256 as placeholder
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

  // Generate order ID (20 characters)
  generateOrderId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `IQOS_${timestamp}_${random}`.toUpperCase().slice(0, 20);
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
        amount: {
          value: this.formatAmount(amount),
          currency: 'IDR'
        },
        additionalInfo: {
          originalTransactionDate: originalTransactionDate,
          terminalId: this.terminalId,
          originalApprovalCode: '', // Should be provided from original transaction
          memberBank: '999'
        }
      };

      const requestBody = JSON.stringify(payload);
      const signature = this.generateSignature('POST', '/v3.0/qr/qr-mpm-cancel', requestBody, timestamp);

      const response = await fetch(`${this.baseURL}/v3.0/qr/qr-mpm-cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`,
          'X-TIMESTAMP': timestamp,
          'X-SIGNATURE': signature,
          'X-EXTERNAL-ID': externalId,
          'X-PARTNER-ID': this.partnerId,
          'CHANNEL-ID': this.channelId
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
