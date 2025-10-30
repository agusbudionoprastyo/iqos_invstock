# QR Payment API Documentation

## Overview

This documentation describes the QR Payment API for generating QRIS codes, checking transaction status, canceling payments, and receiving payment notifications. The API follows REST principles and uses JWT for authentication.

## Table of Contents

- [Authentication](#authentication)
- [Base URLs](#base-urls)
- [Global Parameters](#global-parameters)
- [API Endpoints](#api-endpoints)
- [Field Descriptions](#field-descriptions)
- [Signature Generation](#signature-generation)
- [Response Codes](#response-codes)

## Authentication

All API requests (except token generation) require a Bearer token in the Authorization header.

### Get Authentication Token

**Endpoint:** `POST /qr/v2.0/access-token/b2b`

**Request Headers:**
- `Content-Type: application/json`
- `X-TIMESTAMP: 2024-03-07T09:21:46+07:00` (current timestamp)
- `X-CLIENT-KEY: [username]`
- `X-SIGNATURE: [signature]`

**Request Body:**
```json
{
  "grantType": "client_credentials"
}
```

**Response:**
```json
{
  "responseCode": "2007300",
  "responseMessage": "Successful",
  "accessToken": "eyJraWQiOi...",
  "tokenType": "Bearer",
  "expiresIn": "900"
}
```

**Note:** Tokens expire in 15 minutes (900 seconds).

## Base URLs

| Environment | URL |
|-------------|-----|
| Development | `https://dev.yokke.co.id:7778/` |
| Testing | `https://tst.yokke.co.id:7778/` |
| Production | `https://api.yokke.co.id:7778/` |

## Global Parameters

### Header Fields

| Field | Type | Length | Description |
|-------|------|--------|-------------|
| Content-Type | String | 16 | Always `application/json` |
| Authorization | String | N/A | Bearer token for authenticated requests |
| X-TIMESTAMP | String | 25 | DateTime in ISO-8601 format |
| X-SIGNATURE | String | N/A | HMAC signature for message verification |
| X-EXTERNAL-ID | String | 15 | Unique reference number (same day) |
| X-PARTNER-ID | String | 32 | Partner identifier (e.g., "MTI-STORE") |
| CHANNEL-ID | String | 2 | Device channel (01: EDC, 02: POS) |

### Common Body Fields

| Field | Type | Description |
|-------|------|-------------|
| merchantId | String | 15-digit merchant identifier |
| terminalId | String | 8-digit terminal identifier |
| partnerReferenceNo | String | Transaction ID from consumer system |
| amount | Object | Transaction amount {value, currency} |
| feeAmount | Object | Fee amount {value, currency} |

## API Endpoints

### 1. QR Generation (MPM)

Generate QRIS code for payment.

**Endpoint:** `POST /v2.0/qr/qr-mpm-generate`

**Service Code:** `47`

**Request Headers:**
- `Content-Type: application/json`
- `Authorization: Bearer [token]`
- `X-TIMESTAMP: [timestamp]`
- `X-SIGNATURE: [signature]`
- `X-EXTERNAL-ID: [unique_ref]`
- `X-PARTNER-ID: [partner_id]`
- `CHANNEL-ID: [01/02]`

**Request Body:**
```json
{
  "merchantId": "00007100010926",
  "terminalId": "72001126",
  "partnerReferenceNo": "230218123798000",
  "amount": {
    "value": "100000.00",
    "currency": "IDR"
  },
  "feeAmount": {
    "value": "0.00",
    "currency": "IDR"
  },
  "additionalInfo": {
    "memberBank": "999"
  }
}
```

**Response:**
```json
{
  "responseCode": "2004700",
  "responseMessage": "Successful",
  "referenceNo": "908718002198",
  "partnerReferenceNo": "230218123798000",
  "qrContent": "00020101021226690021...304BAD7",
  "terminalId": "72001126",
  "additionalInfo": {
    "merchantId": "00007100010926"
  }
}
```

### 2. QR Inquiry Status (MPM)

Check transaction status.

**Endpoint:** `POST /v3.0/qr/qr-mpm-query`

**Service Code:** `51`

**Request Body:**
```json
{
  "originalReferenceNo": "506511669691",
  "originalExternalId": "BPRLEXTRNL00048",
  "serviceCode": "47",
  "merchantId": "000071000026521",
  "additionalInfo": {
    "originalTransactionDate": "20250306",
    "terminalId": "73001500",
    "memberBank": "999"
  }
}
```

**Response:**
```json
{
  "responseCode": "2005100",
  "responseMessage": "Successful",
  "originalReferenceNo": "506511669694",
  "originalExternalId": "BPRLEXTRNL00048",
  "serviceCode": "47",
  "latestTransactionStatus": "00",
  "transactionStatusDesc": "Success",
  "terminalId": "73001500",
  "paidTime": "2025-03-06T11:48:27",
  "amount": {
    "value": "1042.00",
    "currency": "IDR"
  },
  "feeAmount": {
    "value": "0.00",
    "currency": "IDR"
  },
  "additionalInfo": {
    "merchantId": "000071000026521",
    "approvalCode": "222423",
    "customerNumber": "936000080100023743",
    "destinationNumber": "9360000812138965527",
    "customerName": "Hevyka",
    "bankCode": "999",
    "issuerName": "Anonyms",
    "issuerReferenceID": "000110000023"
  }
}
```

### 3. QR Payment Credit Cancel (MPM)

Cancel/refund a successful transaction.

**Endpoint:** `POST /v3.0/qr/qr-mpm-cancel`

**Service Code:** `77`

**Request Body:**
```json
{
  "originalReferenceNo": "506511669694",
  "originalPartnerReferenceNo": "0000000000000000087",
  "originalExternalId": "BPREXTRNL00048",
  "merchantId": "000071000026521",
  "reason": "Customer cancelation",
  "amount": {
    "value": "1042.00",
    "currency": "IDR"
  },
  "additionalInfo": {
    "originalTransactionDate": "20250306",
    "terminalId": "73001500",
    "originalApprovalCode": "222423",
    "memberBank": "999"
  }
}
```

**Response:**
```json
{
  "responseCode": "2007700",
  "responseMessage": "Successful",
  "originalReferenceNo": "506511669694",
  "cancelTime": "2025-03-07T14:22:23",
  "additionalInfo": {
    "approvalCode": "922967",
    "referenceNo": "506614670670"
  }
}
```

### 4. QR Payment Credit Notify

Receive payment notifications from MTI.

**Endpoint:** `POST /qr/qr-mpm-notify` (on merchant side)

**Service Code:** `52`

**Request from MTI:**
```json
{
  "originalReferenceNo": "908718002198",
  "latestTransactionStatus": "00",
  "transactionStatusDesc": "Success",
  "customerNumber": "1234123412341234",
  "destinationNumber": "1234123412341234",
  "amount": {
    "value": "100000.00",
    "currency": "IDR"
  },
  "bankCode": "999",
  "additionalInfo": {
    "merchantId": "00007100010926",
    "terminalId": "12345678",
    "approvalCode": "123456",
    "customerName": "Customer Pay",
    "issuerName": "Anonyms",
    "issuerReferenceID": "23021812379800"
  }
}
```

**Response (from Merchant):**
```json
{
  "responseCode": "2005200",
  "responseMessage": "Successful"
}
```

## Signature Generation

### For Token Generation (Asymmetric)
```javascript
stringToSign = X-CLIENT-KEY + "|" + X-TIMESTAMP
signature = SHA256withRSA(private_key, stringToSign)
```

### For API Requests (Symmetric)
```javascript
stringToSign = HTTPMethod + ":" + EndpointUrl + ":" + AccessToken + ":" + 
               Lowercase(SHA256(minify(RequestBody))) + ":" + TimeStamp

signature = base64(HMAC_SHA512(ClientSecret, stringToSign))
```

**Example:**
- HTTPMethod: `POST`
- EndpointUrl: `/v2.0/qr/qr-mpm-generate`
- AccessToken: `eyJraWQiOi...`
- RequestBody: `{"partnerReferenceNo":"2211102900000003108","amount":{"value":"10000.00","currency":"IDR"}...}`
- TimeStamp: `2024-03-07T09:21:46+07:00`

## Response Codes

### HTTP Status Codes

| HTTP Code | Description |
|-----------|-------------|
| 200 | Success |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 500 | Internal Server Error |
| 504 | Timeout |

### Business Response Codes

| Code | Description |
|------|-------------|
| 00 | Success |
| 02 | Unauthorized Signature |
| 03 | Invalid Merchant |
| 05 | Do Not Honor |
| 06 | General Error |
| 12 | Invalid Transaction Status |
| 13 | Invalid Amount |
| 30 | Bad Request |
| 51 | Insufficient Funds |
| 54 | Transaction Expired |
| 57 | QR Invalid/Expired |
| 59 | Suspected Fraud |
| 61 | Exceeds Transaction Amount Limit |
| 68, 90 | Timeout |
| 94 | Paid Bill |
| 99 | Invalid Mandatory Field |
| A5 | Invalid Terminal |
| A6 | Merchant Blacklisted / Transaction Not Found |
| A7 | Feature Not Allowed |
| AH | Transaction Cancelled |
| D1 | Inconsistent Request |
| D2 | Duplicate X-EXTERNAL-ID |

## Transaction Status Codes

| Code | Status |
|------|--------|
| 00 | Success |
| 01 | Initiated |
| 02 | Paying |
| 03 | Pending |
| 04 | Refunded |
| 05 | Canceled |
| 06 | Failed |
| 07 | Not found |

## Important Notes

1. **X-EXTERNAL-ID** must be unique within the same day
2. Tokens expire in 15 minutes
3. All timestamps must be in ISO-8601 format with timezone
4. Amount values must be formatted with 2 decimal places
5. Merchant and terminal IDs are provided separately for each merchant
6. Signature verification is mandatory for all requests

## Support

For technical support or questions regarding implementation, please contact the MTI technical team.

---

**Document Version:** 1.1.0  
**Last Updated:** 2025-04-21  
**Author:** Auth Team