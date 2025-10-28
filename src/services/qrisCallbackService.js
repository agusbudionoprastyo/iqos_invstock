// QRIS Callback Service
import CryptoJS from 'crypto-js';

class QRISCallbackService {
  constructor() {
    this.clientSecret = 'YOUR_CLIENT_SECRET'; // Same as in qrisService
  }

  // Verify signature from Yokke callback
  verifySignature(requestBody, timestamp, signature) {
    try {
      // Generate expected signature using the same method as Yokke
      const stringToSign = `POST:/qr/qr-mpm-notify:${CryptoJS.SHA256(requestBody).toString(CryptoJS.enc.Hex).toLowerCase()}:${timestamp}`;
      const expectedSignature = CryptoJS.HmacSHA512(stringToSign, this.clientSecret).toString(CryptoJS.enc.Base64);
      
      return signature === expectedSignature;
    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  }

  // Process payment notification from Yokke
  async processPaymentNotification(notificationData) {
    try {
      const {
        originalReferenceNo,
        latestTransactionStatus,
        transactionStatusDesc,
        customerNumber,
        destinationNumber,
        amount,
        bankCode,
        additionalInfo
      } = notificationData;

      // Map transaction status
      const statusMap = {
        '00': 'success',
        '01': 'initiated',
        '02': 'paying',
        '03': 'pending',
        '04': 'refunded',
        '05': 'canceled',
        '06': 'failed',
        '07': 'not_found'
      };

      const paymentStatus = statusMap[latestTransactionStatus] || 'unknown';

      // Update payment status in your system
      const paymentUpdate = {
        referenceNo: originalReferenceNo,
        status: paymentStatus,
        statusDescription: transactionStatusDesc,
        amount: amount,
        customerNumber: customerNumber,
        destinationNumber: destinationNumber,
        bankCode: bankCode,
        approvalCode: additionalInfo?.approvalCode,
        customerName: additionalInfo?.customerName,
        issuerName: additionalInfo?.issuerName,
        issuerReferenceID: additionalInfo?.issuerReferenceID,
        processedAt: new Date().toISOString()
      };

      // Here you would typically:
      // 1. Update your database with payment status
      // 2. Send notification to user
      // 3. Update inventory if payment successful
      // 4. Generate receipt if needed

      console.log('Payment notification processed:', paymentUpdate);

      return {
        success: true,
        responseCode: '2005200',
        responseMessage: 'Success',
        data: paymentUpdate
      };
    } catch (error) {
      console.error('Payment notification processing error:', error);
      return {
        success: false,
        responseCode: '5005200',
        responseMessage: 'Internal Server Error',
        error: error.message
      };
    }
  }

  // Generate response for Yokke
  generateResponse(success, responseCode, responseMessage) {
    return {
      responseCode: responseCode,
      responseMessage: responseMessage,
      timestamp: new Date().toISOString()
    };
  }

  // Handle callback request (for backend implementation)
  async handleCallbackRequest(request) {
    try {
      const headers = request.headers;
      const body = await request.text();
      
      // Extract required headers
      const timestamp = headers.get('X-TIMESTAMP');
      const signature = headers.get('X-SIGNATURE');
      const externalId = headers.get('X-EXTERNAL-ID');
      const partnerId = headers.get('X-PARTNER-ID');
      const channelId = headers.get('CHANNEL-ID');

      // Verify signature
      if (!this.verifySignature(body, timestamp, signature)) {
        return this.generateResponse(false, '4015200', 'Unauthorized Signature');
      }

      // Parse request body
      const notificationData = JSON.parse(body);

      // Process payment notification
      const result = await this.processPaymentNotification(notificationData);

      return this.generateResponse(
        result.success,
        result.responseCode,
        result.responseMessage
      );
    } catch (error) {
      console.error('Callback request handling error:', error);
      return this.generateResponse(false, '5005200', 'Internal Server Error');
    }
  }
}

// Create singleton instance
const qrisCallbackService = new QRISCallbackService();

export default qrisCallbackService;
