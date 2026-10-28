import express from 'express';
import {
  getSeatAvailability,
  createBooking,
  getMyBookings,
  getBookingById,
  cancelBooking,
  createPaymentOrder,
  verifyPayment,
  handlePaymentWebhook,
} from '../controllers/bookingController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Public — seat availability for a showtime
router.get('/availability/:showtimeId', getSeatAvailability);

// Public — Razorpay webhook
// Body is already a raw Buffer via the express.raw() middleware registered in server.js
// BEFORE the global express.json() — no additional middleware needed here.
router.post('/payment/webhook', handlePaymentWebhook);

// All following booking routes require authentication
router.use(protect);

router.route('/')
  .post(createBooking);            // POST /api/bookings

router.get('/my', getMyBookings);  // GET  /api/bookings/my

router.route('/:id')
  .get(getBookingById);            // GET  /api/bookings/:id

router.post('/:id/cancel', cancelBooking); // POST /api/bookings/:id/cancel

// Payment endpoints
router.post('/:id/payment/create-order', createPaymentOrder);
router.post('/:id/payment/verify', verifyPayment);

export default router;
