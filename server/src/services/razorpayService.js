import Razorpay from 'razorpay';
import crypto from 'crypto';

let razorpayInstance = null;

export const getRazorpayInstance = () => {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;

  if (!key_id || !key_secret) {
    return null;
  }

  if (!razorpayInstance) {
    razorpayInstance = new Razorpay({
      key_id,
      key_secret,
    });
  }

  return razorpayInstance;
};

/**
 * Verify Razorpay payment signature.
 * HMAC SHA256 of (order_id + "|" + payment_id) with key_secret.
 * Uses constant-time comparison to prevent timing attacks.
 */
export const verifyRazorpaySignature = (orderId, paymentId, signature) => {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;
  if (!orderId || !paymentId || !signature) return false;

  const body = `${orderId}|${paymentId}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(signature, 'hex')
    );
  } catch {
    return false;
  }
};

/**
 * Verify Razorpay webhook signature.
 * rawBody MUST be the exact raw request body as a Buffer (set by express.raw() in server.js).
 * Using JSON.stringify() of the parsed body would produce a different byte sequence
 * and break the HMAC comparison.
 */
export const verifyRazorpayWebhookSignature = (rawBody, signature) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) return false;

  // Always work with the raw Buffer — never re-stringify
  const bodyBuffer = Buffer.isBuffer(rawBody)
    ? rawBody
    : Buffer.from(typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody));

  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(bodyBuffer)
    .digest('hex');

  // Constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(Buffer.from(expectedSignature, 'hex'), Buffer.from(signature, 'hex'));
  } catch {
    return false;
  }
};
