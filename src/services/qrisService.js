// QRIS Payment Service using Yokke SNAP API v1.0.11
// Updated to match Yokke documentation specifications
import CryptoJS from 'crypto-js';

class QRISService {
  constructor() {
    // API Configuration - Use same-origin proxy in browser (dev and prod)
    const isBrowser = typeof window !== 'undefined';
    this.baseURL = isBrowser ? '/yokke/qrissnapmpm/1.0.11' : 'https://tst.yokke.co.id:8280/qrissnapmpm/1.0.11';
    this.proxyURL = null; // No proxy
    this.useProxy = false; // Call directly (note: browser may hit CORS)
    this.clientKey = 'p_qSZvutLH1xXym6CY6xWYif55oa'; // Client key from Yokke
    this.clientSecret = 'CRWFqBa9tyWbLJIPcmiCsXWvU7ga'; // Secret key from Yokke
    this.merchantId = '463763743'; // Merchant ID (from provided MID)
    this.terminalId = '12387341'; // Terminal ID (8 digits as per spec)
    this.partnerId = 'DafamHotelSMG'; // X-PARTNER-ID (Token Requestor ID)
    this.channelId = '02'; // Channel ID from documentation
    // Sandbox behavior toggles (align with Postman sandbox expectations)
    this.sandboxMode = true; // set false for real flows
    this.sandboxPartnerId = 'PTKG1';
    this.testPartnerReferenceNo = '230218123798000';
    this.includeFeeAmountInSandbox = true;
    this.accessToken = null;
    this.tokenExpiry = null;
    this.generatingQR = false; // Prevent multiple simultaneous calls
    // Manual token for dev/testing (if auth fails)
    this.manualToken = null;
    // Optional RSA private key (PEM) for token signature as per APIDOC (asymmetric)
    this.privateKeyPem = null; // Fill with PKCS#8 PEM if provided by provider
  }

  // Reset generation lock (useful when switching transactions)
  resetGenerationLock() {
    this.generatingQR = false;
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
        partnerReferenceNo: (this.sandboxMode && this.testPartnerReferenceNo)
          ? this.testPartnerReferenceNo
          : paymentData.orderId.toString(),
        amount: {
          value: paymentData.amount.toFixed(2),
          currency: 'IDR'
        }
      };

      if (this.sandboxMode && this.includeFeeAmountInSandbox) {
        payload.feeAmount = { value: '0.00', currency: 'IDR' };
      }
      
      console.log('Partner Reference No:', paymentData.orderId, 'Type:', typeof paymentData.orderId, 'Length:', paymentData.orderId.toString().length);
      console.log('Callback URL:', callbackUrl);

      const requestBody = JSON.stringify(payload);
      console.log('Generate QR Payload:', payload);
      const signature = this.generateSignature('POST', '/qrissnapmpm/1.0.11/v2.0/qr/qr-mpm-generate', requestBody, timestamp);
      console.log('Generated Signature:', signature);
      console.log('Request Body:', requestBody);

      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${this.accessToken}`,
        'X-TIMESTAMP': timestamp,
        'X-SIGNATURE': signature,
        'X-EXTERNAL-ID': externalId,
        'X-PARTNER-ID': this.sandboxMode ? this.sandboxPartnerId : this.partnerId,
        'CHANNEL-ID': this.channelId,
        'X-PLATFORM': 'PORTAL'
      };
      
      console.log('Request Headers:', headers);
      
      let response;
      // Direct call (browser may block via CORS if not allowed by server)
      response = await fetch(`${this.baseURL}/v2.0/qr/qr-mpm-generate`, {
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
          callbackUrl: callbackUrl,
          externalId: externalId
        });
        return {
          success: true,
          qrContent: result.qrContent,
          referenceNo: result.referenceNo,
          partnerReferenceNo: result.partnerReferenceNo,
          terminalId: result.terminalId,
          callbackUrl: callbackUrl,
          externalId: externalId
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
      const signature = this.generateSignature('POST', '/qrissnapmpm/1.0.11/v3.0/qr/qr-mpm-query', requestBody, timestamp);

      const response = await fetch(`${this.baseURL}/v3.0/qr/qr-mpm-query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
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
    const timestamp = this.getCurrentTimestamp();
    const requestBodyStr = JSON.stringify({ grantType: 'client_credentials' });
    const requestBody = { grantType: 'client_credentials' };
    
    // Verify proxy is accessible first
    if (this.useProxy) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const healthCheck = await fetch(`${this.proxyURL}/api/qris/test`, { 
          method: 'GET',
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (!healthCheck.ok) {
          throw new Error(`Proxy server not accessible. Status: ${healthCheck.status}`);
        }
      } catch (error) {
        if (error.name === 'AbortError') {
          throw new Error('Proxy server timeout. Please ensure proxy server is running with: npm run proxy');
        }
        throw new Error(`Proxy server not accessible: ${error.message}. Please run: npm run proxy`);
      }
    }
    
    
    const signature = await this.generateAuthSignatureAsync(timestamp, requestBodyStr);
    
    let response;
    if (this.useProxy) {
      response = await fetch(`${this.proxyURL}/api/qris/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timestamp,
          clientKey: this.clientKey,
          signature,
          requestBody: requestBodyStr
        })
      });
    } else {
      response = await fetch(`${this.baseURL}/qr/v2.0/access-token/b2b`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-TIMESTAMP': timestamp,
          'X-CLIENT-KEY': this.clientKey,
          'X-SIGNATURE': signature,
          'X-PLATFORM': 'PORTAL'
        },
        body: requestBodyStr
      });
    }

    const responseText = await response.text();
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      throw new Error(`Authentication failed: Non-JSON response (${response.status}).`);
    }

    if (response.ok && result.responseCode === '2007300') {
      this.accessToken = result.accessToken;
      this.tokenExpiry = Date.now() + (parseInt(result.expiredIn) * 1000);
      return result.accessToken;
    }
    
    throw new Error(`Authentication failed: ${result.responseMessage || response.statusText}`);
  }

  // Ensure we have a valid access token
  async ensureValidToken() {
    if (!this.accessToken || !this.tokenExpiry || Date.now() >= this.tokenExpiry) {
      await this.getAccessToken();
    }
  }

  // Generate signature for API requests
  generateSignature(method, endpoint, requestBody, timestamp) {
    // Minify request body (remove whitespace) for SHA256 calculation
    const minifiedBody = JSON.stringify(JSON.parse(requestBody));
    const bodyHash = CryptoJS.SHA256(minifiedBody).toString(CryptoJS.enc.Hex).toLowerCase();
    
    // Format: METHOD:ENDPOINT:ACCESS_TOKEN:BODY_HASH:TIMESTAMP
    const stringToSign = `${method}:${endpoint}:${this.accessToken}:${bodyHash}:${timestamp}`;
    
    // Use HMAC-SHA512 as per Yokke documentation example
    const signature = CryptoJS.HmacSHA512(stringToSign, this.clientSecret).toString(CryptoJS.enc.Base64);
    
    console.log('Signature Generation Debug:', {
      method,
      endpoint,
      bodyHash,
      timestamp,
      stringToSignLength: stringToSign.length,
      signature
    });
    
    return signature;
  }

  // Generate authentication signature (prefers RSA as per APIDOC; falls back to HMAC if no key)
  async generateAuthSignatureAsync(timestamp, requestBody = '{"grantType":"client_credentials"}') {
    if (this.privateKeyPem) {
      const stringToSign = `${this.clientKey}|${timestamp}`; // Asymmetric per APIDOC
      const signatureArrayBuffer = await this.rsaSignSHA256(this.privateKeyPem, stringToSign);
      const signature = this.arrayBufferToBase64(signatureArrayBuffer);
      console.log('Auth Signature Generation (RSA-SHA256):', { stringToSignPreview: stringToSign.substring(0, 160), signature });
      return signature;
    }
    // Fallback to HMAC-SHA512 using endpoint path per Postman collection
    const bodyHash = CryptoJS.SHA256(requestBody).toString(CryptoJS.enc.Hex).toLowerCase();
    const endpoint = '/qrissnapmpm/1.0.11/qr/v2.0/access-token/b2b';
    const stringToSign = `POST:${endpoint}:${this.clientKey}:${bodyHash}:${timestamp}`;
    const signature = CryptoJS.HmacSHA512(stringToSign, this.clientSecret).toString(CryptoJS.enc.Base64);
    console.log('Auth Signature Generation (HMAC fallback):', { endpoint, bodyHash, timestamp, stringToSignPreview: stringToSign.substring(0, 160), signature });
    return signature;
  }

  // Helpers for RSA signing using Web Crypto API
  async rsaSignSHA256(privateKeyPem, data) {
    const key = await this.importPrivateKey(privateKeyPem);
    const enc = new TextEncoder();
    return await crypto.subtle.sign(
      { name: 'RSASSA-PKCS1-v1_5' },
      key,
      enc.encode(data)
    );
  }

  async importPrivateKey(pem) {
    const binaryDer = this.pemToArrayBuffer(pem);
    return await crypto.subtle.importKey(
      'pkcs8',
      binaryDer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign']
    );
  }

  pemToArrayBuffer(pem) {
    const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----/g, '')
                  .replace(/-----END PRIVATE KEY-----/g, '')
                  .replace(/\s+/g, '');
    const raw = atob(b64);
    const buffer = new ArrayBuffer(raw.length);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < raw.length; i++) {
      view[i] = raw.charCodeAt(i);
    }
    return buffer;
  }

  arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  // Get current timestamp in ISO format with timezone WIB (+07:00)
  // Format: 2024-03-07T09:21:46+07:00 (no milliseconds for auth signature)
  getCurrentTimestamp() {
    const now = new Date();
    
    // Convert to WIB timezone (UTC+7)
    const wibOffset = 7 * 60; // 7 hours in minutes
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const wibTime = new Date(utc + (wibOffset * 60000));
    
    // Format: YYYY-MM-DDTHH:mm:ss+07:00
    const year = wibTime.getFullYear();
    const month = String(wibTime.getMonth() + 1).padStart(2, '0');
    const day = String(wibTime.getDate()).padStart(2, '0');
    const hours = String(wibTime.getHours()).padStart(2, '0');
    const minutes = String(wibTime.getMinutes()).padStart(2, '0');
    const seconds = String(wibTime.getSeconds()).padStart(2, '0');
    
    // Format without milliseconds: 2024-03-07T09:21:46+07:00
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+07:00`;
  }

  // Generate external ID (15 digit numeric string)
  generateExternalId() {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return (timestamp + random).slice(-15);
  }

  // Generate order ID (20 characters) - numeric format like sample data
  generateOrderId() {
    // Generate unique numeric partnerReferenceNo per transaction (≤ 20 digits)
    // With real sandbox credentials, we can use unique IDs instead of test cases
    const now = new Date();
    const pad2 = (n) => n.toString().padStart(2, '0');
    const y = now.getFullYear().toString().slice(-2); // YY
    const MM = pad2(now.getMonth() + 1);
    const dd = pad2(now.getDate());
    const hh = pad2(now.getHours());
    const mm = pad2(now.getMinutes());
    const ss = pad2(now.getSeconds());
    const ms = now.getMilliseconds().toString().padStart(3, '0');
    const rand = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const orderId = `${y}${MM}${dd}${hh}${mm}${ss}${ms}${rand}`; // 18 digits
    console.log('Generated Order ID:', orderId);
    return orderId;
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
  async cancelPayment(originalReferenceNo, originalPartnerReferenceNo, originalExternalId, reason, amount, approvalCode) {
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
          originalApprovalCode: approvalCode || ''
        }
      };

      const requestBody = JSON.stringify(payload);
      const signature = this.generateSignature('POST', '/qrissnapmpm/1.0.11/v3.0/qr/qr-mpm-cancel', requestBody, timestamp);

      const response = await fetch(`${this.baseURL}/v3.0/qr/qr-mpm-cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
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
