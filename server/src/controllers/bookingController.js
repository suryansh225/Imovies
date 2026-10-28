import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import Showtime from '../models/Showtime.js';
import Screen from '../models/Screen.js';
import SeatReservation from '../models/SeatReservation.js';
import {
  getRazorpayInstance,
  verifyRazorpaySignature,
  verifyRazorpayWebhookSignature,
} from '../services/razorpayService.js';

// Seat hold duration in minutes (default 10 minutes)
const SEAT_HOLD_DURATION_MINUTES = 10;

/**
 * Clean up expired seat holds for a given showtime (or all showtimes).
 * Marks expired bookings as 'expired' and deletes their SeatReservation documents.
 */
export async function releaseExpiredHolds(showtimeId = null) {
  const now = new Date();
  const filter = {
    status: 'held',
    expiresAt: { $lt: now, $ne: null },
  };
  if (showtimeId) {
    filter.showtime = showtimeId;
  }

  // Find expired reservations
  const expiredRes = await SeatReservation.find(filter).lean();
  if (expiredRes.length === 0) return 0;

  const bookingIds = [...new Set(expiredRes.map((r) => r.booking).filter(Boolean))];

  // Mark pending bookings as expired
  if (bookingIds.length > 0) {
    await Booking.updateMany(
      {
        _id: { $in: bookingIds },
        status: 'pending_payment',
        paymentStatus: 'pending',
      },
      {
        $set: { status: 'expired', paymentStatus: 'failed' },
      }
    );
  }

  // Delete expired seat reservations so seats are freed immediately
  const resIds = expiredRes.map((r) => r._id);
  const deleteResult = await SeatReservation.deleteMany({ _id: { $in: resIds } });
  return deleteResult.deletedCount;
}

/**
 * Build the full seat availability map for a showtime.
 * Purges expired holds first so availability is strictly up to date.
 */
async function buildSeatAvailability(showtimeId, screen) {
  // Purge any expired holds for this showtime first
  await releaseExpiredHolds(showtimeId);

  // Active reservations (either confirmed or currently valid held)
  const activeReservations = await SeatReservation.find({
    showtime: showtimeId,
  }).select('seatId status expiresAt').lean();

  const bookedSeatIds = new Set(activeReservations.map((r) => r.seatId));

  const layout = screen.seatLayout || { premium: [], gold: [], silver: [] };
  const cols = screen.columns || 10;
  const result = { premium: [], gold: [], silver: [] };

  for (const category of ['premium', 'gold', 'silver']) {
    const rows = layout[category] || [];
    for (const row of rows) {
      for (let col = 1; col <= cols; col++) {
        const seatId = `${row}${col}`;
        result[category].push({
          seatId,
          row,
          number: col,
          category,
          status: bookedSeatIds.has(seatId) ? 'booked' : 'available',
        });
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// GET /api/bookings/availability/:showtimeId
// @access Public
// ---------------------------------------------------------------------------
export const getSeatAvailability = async (req, res, next) => {
  try {
    const { showtimeId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(showtimeId)) {
      return res.status(400).json({ success: false, message: 'Invalid showtime ID format' });
    }

    const showtime = await Showtime.findById(showtimeId)
      .populate('screen', 'name screenType seatLayout columns totalSeats')
      .lean();

    if (!showtime) {
      return res.status(404).json({ success: false, message: 'Showtime not found' });
    }
    if (!showtime.isActive || showtime.status === 'cancelled') {
      return res.status(410).json({ success: false, message: 'Showtime is cancelled or unavailable' });
    }
    if (new Date(showtime.endTime) < new Date()) {
      return res.status(410).json({ success: false, message: 'Showtime has already ended' });
    }

    const availability = await buildSeatAvailability(showtimeId, showtime.screen);
    const totalSeats = showtime.screen.totalSeats || 0;
    const bookedCount = Object.values(availability).flat().filter((s) => s.status === 'booked').length;

    return res.status(200).json({
      success: true,
      showtimeId,
      screen: {
        _id: showtime.screen._id,
        name: showtime.screen.name,
        screenType: showtime.screen.screenType,
        columns: showtime.screen.columns,
        totalSeats,
      },
      pricing: showtime.pricing,
      availability,
      summary: { total: totalSeats, booked: bookedCount, available: totalSeats - bookedCount },
    });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /api/bookings
// @access Private (authenticated user)
// Creates an expiring seat hold & pending booking.
// ---------------------------------------------------------------------------
export const createBooking = async (req, res, next) => {
  let reservedDocs = [];
  try {
    const { showtimeId, seatIds } = req.body;
    const userId = req.user._id;

    // ── Basic validation ───────────────────────────────────────────────────
    if (!showtimeId || !Array.isArray(seatIds) || seatIds.length === 0) {
      return res.status(400).json({ success: false, message: 'showtimeId and a non-empty seatIds array are required' });
    }
    if (!mongoose.Types.ObjectId.isValid(showtimeId)) {
      return res.status(400).json({ success: false, message: 'Invalid showtime ID format' });
    }

    // Deduplicate request seat IDs
    const uniqueSeatIds = [...new Set(seatIds)];
    if (uniqueSeatIds.length !== seatIds.length) {
      return res.status(400).json({ success: false, message: 'Duplicate seats specified in request' });
    }

    if (uniqueSeatIds.length > 10) {
      return res.status(400).json({ success: false, message: 'Cannot book more than 10 seats per transaction' });
    }

    const seatIdPattern = /^[A-Z][0-9]{1,2}$/;
    for (const sid of uniqueSeatIds) {
      if (typeof sid !== 'string' || !seatIdPattern.test(sid)) {
        return res.status(400).json({
          success: false,
          message: `Invalid seat ID format: "${sid}". Expected format: row letter + column number (e.g. A1, B10)`,
        });
      }
    }

    // ── Fetch showtime ─────────────────────────────────────────────────────
    const showtime = await Showtime.findById(showtimeId)
      .populate('screen', 'name screenType seatLayout columns totalSeats')
      .lean();

    if (!showtime) return res.status(404).json({ success: false, message: 'Showtime not found' });
    if (!showtime.isActive || showtime.status === 'cancelled') {
      return res.status(410).json({ success: false, message: 'Showtime is cancelled or no longer available' });
    }
    if (new Date(showtime.startTime) < new Date()) {
      return res.status(410).json({ success: false, message: 'Cannot book seats for a showtime that has already started' });
    }

    // ── Validate seat identifiers against screen layout ────────────────────
    const layout = showtime.screen.seatLayout || { premium: [], gold: [], silver: [] };
    const cols = showtime.screen.columns || 10;
    const allValidRows = [
      ...(layout.premium || []),
      ...(layout.gold || []),
      ...(layout.silver || []),
    ];

    const categoryByRow = {};
    for (const row of (layout.premium || [])) categoryByRow[row] = 'premium';
    for (const row of (layout.gold    || [])) categoryByRow[row] = 'gold';
    for (const row of (layout.silver  || [])) categoryByRow[row] = 'silver';

    for (const sid of uniqueSeatIds) {
      const row = sid.charAt(0);
      const col = parseInt(sid.slice(1), 10);
      if (!allValidRows.includes(row)) {
        return res.status(400).json({ success: false, message: `Row "${row}" does not exist in this screen's layout` });
      }
      if (col < 1 || col > cols) {
        return res.status(400).json({ success: false, message: `Seat column ${col} is out of range for this screen (1–${cols})` });
      }
    }

    // ── Release any expired holds before reserving ─────────────────────────
    await releaseExpiredHolds(showtimeId);

    // Calculate expiry timestamp for this hold
    const expiresAt = new Date(Date.now() + SEAT_HOLD_DURATION_MINUTES * 60 * 1000);

    // ── Atomically claim seats via SeatReservation collection ───────────────
    const reservationDocs = uniqueSeatIds.map((sid) => ({
      showtime: showtimeId,
      seatId: sid,
      user: userId,
      status: 'held',
      expiresAt,
    }));

    try {
      // insertMany with ordered: true guarantees atomic block or throws 11000
      reservedDocs = await SeatReservation.insertMany(reservationDocs);
    } catch (insertErr) {
      // If code is 11000, check if the conflict was an expired reservation
      await releaseExpiredHolds(showtimeId);

      // Clean up any partially inserted docs from this attempt
      if (insertErr.insertedDocs && insertErr.insertedDocs.length > 0) {
        const insertedIds = insertErr.insertedDocs.map((d) => d._id);
        await SeatReservation.deleteMany({ _id: { $in: insertedIds } }).catch(() => {});
      }
      return res.status(409).json({
        success: false,
        message: 'One or more selected seats have already been booked or held. Please choose different seats.',
      });
    }

    // ── Build seat items with server-authoritative prices ──────────────────
    const seatItems = uniqueSeatIds.map((sid) => {
      const row = sid.charAt(0);
      const col = parseInt(sid.slice(1), 10);
      const category = categoryByRow[row];
      const price = showtime.pricing[category] || 0;
      return { seatId: sid, row, number: col, category, price };
    });

    const totalAmount = seatItems.reduce((sum, s) => sum + s.price, 0);

    // ── Create the pending booking record ──────────────────────────────────
    let newBooking;
    try {
      newBooking = await Booking.create({
        user: userId,
        showtime: showtimeId,
        movie: showtime.movie,
        theatre: showtime.theatre,
        screen: showtime.screen._id,
        seats: seatItems,
        totalAmount,
        status: 'pending_payment',
        paymentStatus: 'pending',
        expiresAt,
      });

      // Link reservations to the created booking
      const reservationIds = reservedDocs.map((d) => d._id);
      await SeatReservation.updateMany(
        { _id: { $in: reservationIds } },
        { $set: { booking: newBooking._id } }
      );
    } catch (createErr) {
      // Rollback seat reservations if booking record creation fails
      if (reservedDocs.length > 0) {
        const reservationIds = reservedDocs.map((d) => d._id);
        await SeatReservation.deleteMany({ _id: { $in: reservationIds } }).catch(() => {});
      }
      throw createErr;
    }

    const populated = await Booking.findById(newBooking._id)
      .populate('movie',    'title poster language certificate')
      .populate('theatre',  'name location city')
      .populate('screen',   'name screenType')
      .populate('showtime', 'startTime endTime pricing formattedTime')
      .lean({ virtuals: true });

    return res.status(201).json({
      success: true,
      message: 'Seats held successfully. Please complete payment within 10 minutes.',
      booking: populated,
      expiresAt,
    });
  } catch (err) {
    if (reservedDocs && reservedDocs.length > 0) {
      const reservationIds = reservedDocs.map((d) => d._id);
      await SeatReservation.deleteMany({ _id: { $in: reservationIds } }).catch(() => {});
    }
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /api/bookings/:id/payment/create-order
// @access Private (booking owner only)
// Generates a Razorpay Order ID for a pending booking.
// ---------------------------------------------------------------------------
export const createPaymentOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid booking ID format' });
    }

    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.user.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized for this booking' });
    }

    // Guard against paying for a cancelled or expired booking
    if (booking.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Cannot verify payment for a cancelled booking' });
    }
    if (booking.status === 'expired') {
      return res.status(410).json({ success: false, message: 'Seat hold has expired. Please select seats again.' });
    }

    if (booking.paymentStatus === 'paid') {
      return res.status(400).json({ success: false, message: 'Booking has already been paid' });
    }

    // Check expiry
    if (booking.expiresAt && new Date(booking.expiresAt) < new Date()) {
      booking.status = 'expired';
      booking.paymentStatus = 'failed';
      await booking.save();
      await SeatReservation.deleteMany({ booking: booking._id });
      return res.status(410).json({ success: false, message: 'Seat hold has expired. Please select seats again.' });
    }

    const razorpay = getRazorpayInstance();

    // If Razorpay credentials are not configured, fail clearly — never return a mock order.
    // A mock order would allow the frontend to submit a fake signature to verifyPayment.
    if (!razorpay) {
      return res.status(503).json({
        success: false,
        message: 'Payment service is not configured. Please contact support.',
      });
    }

    // Create real Razorpay order in paise (₹1 = 100 paise)
    const orderOptions = {
      amount: Math.round(booking.totalAmount * 100),
      currency: 'INR',
      receipt: booking.bookingRef,
      notes: {
        bookingId: booking._id.toString(),
        userId: userId.toString(),
      },
    };

    const order = await razorpay.orders.create(orderOptions);
    booking.razorpayOrderId = order.id;
    await booking.save();

    return res.status(200).json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      bookingRef: booking.bookingRef,
    });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /api/bookings/:id/payment/verify
// @access Private (booking owner only)
// Verifies HMAC SHA256 signature from Razorpay checkout.
// ---------------------------------------------------------------------------
export const verifyPayment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid booking ID format' });
    }

    if (!razorpay_order_id || !razorpay_payment_id) {
      return res.status(400).json({ success: false, message: 'Missing Razorpay order or payment ID' });
    }

    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.user.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized for this booking' });
    }

    // Guard against paying for a cancelled or expired booking
    if (booking.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Cannot verify payment for a cancelled booking' });
    }
    if (booking.status === 'expired') {
      return res.status(410).json({ success: false, message: 'Seat hold has expired. Please select seats again.' });
    }

    if (booking.paymentStatus === 'paid') {
      return res.status(200).json({
        success: true,
        message: 'Booking was already verified and paid.',
        booking,
      });
    }

    // Prevent cross-booking order hijacking
    if (booking.razorpayOrderId && booking.razorpayOrderId !== razorpay_order_id) {
      return res.status(400).json({ success: false, message: 'Order ID mismatch for this booking' });
    }

    // Check if this payment ID was already applied to another booking
    const existingPayment = await Booking.findOne({
      razorpayPaymentId: razorpay_payment_id,
      _id: { $ne: booking._id },
    });
    if (existingPayment) {
      return res.status(409).json({ success: false, message: 'Payment ID has already been credited to another booking' });
    }

    // Verify signature — must pass before any state changes
    const isValidSignature = verifyRazorpaySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isValidSignature) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment signature. Payment could not be verified.',
      });
    }

    // Late-payment guard: verify seat reservations still belong to this booking.
    // If the hold expired and was re-reserved by another user, we must NOT steal those seats.
    const activeReservations = await SeatReservation.find({ booking: booking._id });
    if (activeReservations.length === 0) {
      return res.status(410).json({
        success: false,
        message: 'Seat hold has expired and seats have been released. Payment cannot be confirmed — please contact support for a refund.',
      });
    }

    // Update booking to confirmed and paid
    booking.paymentStatus = 'paid';
    booking.status = 'confirmed';
    booking.razorpayPaymentId = razorpay_payment_id;
    booking.razorpaySignature = razorpay_signature;
    booking.paidAt = new Date();
    booking.expiresAt = null; // No longer expires
    await booking.save();

    // Mark SeatReservation as permanently confirmed
    await SeatReservation.updateMany(
      { booking: booking._id },
      { $set: { status: 'confirmed', expiresAt: null } }
    );

    const populated = await Booking.findById(booking._id)
      .populate('movie',    'title poster language certificate')
      .populate('theatre',  'name location city')
      .populate('screen',   'name screenType')
      .populate('showtime', 'startTime endTime pricing formattedTime')
      .lean({ virtuals: true });

    return res.status(200).json({
      success: true,
      message: 'Payment verified successfully! Tickets confirmed.',
      booking: populated,
    });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /api/bookings/payment/webhook
// @access Public (Razorpay server callback)
// Webhook endpoint with HMAC SHA256 signature verification.
// Handles 'payment.captured' and 'payment.failed' idempotently.
// ---------------------------------------------------------------------------
export const handlePaymentWebhook = async (req, res, next) => {
  try {
    // ── 1. Authenticate webhook signature ─────────────────────────────────────
    const signature = req.headers['x-razorpay-signature'];
    if (!signature) {
      console.warn('[Webhook] Missing x-razorpay-signature header');
      return res.status(400).json({ success: false, message: 'Missing Razorpay signature header' });
    }

    // req.body is a raw Buffer (set by express.raw() in server.js BEFORE express.json()).
    // Pass it directly — verifyRazorpayWebhookSignature handles Buffer input.
    const isValid = verifyRazorpayWebhookSignature(req.body, signature);
    if (!isValid) {
      console.warn('[Webhook] Invalid webhook HMAC signature');
      return res.status(400).json({ success: false, message: 'Invalid webhook signature' });
    }

    // ── 2. Parse payload ────────────────────────────────────────────────────────
    let parsed;
    try {
      parsed = JSON.parse(req.body.toString());
    } catch {
      console.error('[Webhook] Failed to parse JSON body');
      return res.status(400).json({ success: false, message: 'Malformed webhook payload' });
    }

    const event = parsed.event;
    // Razorpay standard webhook payloads wrap the entity under payload.payment.entity,
    // but some webhook simulations or direct payloads may provide it at payload.payment directly.
    const payment = parsed.payload?.payment?.entity || parsed.payload?.payment;
    console.log(`[Webhook] Event received: "${event}", payment id: ${payment?.id || 'none'}`);

    // ── 3. Handle payment.captured ──────────────────────────────────────────────
    if (event === 'payment.captured' && payment) {
      const orderId = payment.order_id;
      const paymentId = payment.id;
      const paymentAmount = payment.amount; // In paise
      const paymentCurrency = payment.currency;

      if (!orderId || !paymentId) {
        console.warn('[Webhook] payment.captured missing order_id or id');
        return res.status(400).json({ success: false, message: 'Missing order_id or payment id in payload' });
      }

      const booking = await Booking.findOne({ razorpayOrderId: orderId });
      if (!booking) {
        console.warn(`[Webhook] No booking found for order ID: ${orderId}`);
        return res.status(404).json({ success: false, message: 'Booking not found for order' });
      }

      // Check currency
      if (paymentCurrency && paymentCurrency.toUpperCase() !== 'INR') {
        console.error(`[Webhook] Currency mismatch: expected INR, got ${paymentCurrency}`);
        return res.status(400).json({ success: false, message: 'Currency mismatch' });
      }

      // Check amount (in paise)
      const expectedAmountPaise = Math.round(booking.totalAmount * 100);
      if (paymentAmount !== undefined && paymentAmount !== expectedAmountPaise) {
        console.error(`[Webhook] Amount mismatch for booking ${booking._id}: expected ${expectedAmountPaise}, got ${paymentAmount}`);
        return res.status(400).json({ success: false, message: 'Amount mismatch' });
      }

      // Idempotency: If booking already marked as paid
      if (booking.paymentStatus === 'paid') {
        console.log(`[Webhook] Booking ${booking._id} already confirmed with payment ${booking.razorpayPaymentId}`);
        return res.status(200).json({ status: 'ok', message: 'Booking already confirmed' });
      }

      // Check if booking is in an un-confirmable state (cancelled)
      if (booking.status === 'cancelled') {
        console.warn(`[Webhook] Received capture for cancelled booking ${booking._id}`);
        return res.status(409).json({ success: false, message: 'Booking has been cancelled' });
      }

      // Check seat reservations still belong to this booking and have not expired
      const activeRes = await SeatReservation.find({ booking: booking._id });
      if (activeRes.length === 0) {
        console.warn(`[Webhook] Seat hold expired and seats released for booking ${booking._id}. Cannot confirm.`);
        booking.status = 'expired';
        booking.paymentStatus = 'failed';
        await booking.save();
        return res.status(410).json({
          success: false,
          message: 'Seat hold expired and seats have been released. Booking cannot be confirmed.',
        });
      }

      // Check for duplicate payment ID across other bookings
      const existingPayment = await Booking.findOne({
        razorpayPaymentId: paymentId,
        _id: { $ne: booking._id },
      });
      if (existingPayment) {
        console.error(`[Webhook] Conflicting payment ID ${paymentId} already credited to ${existingPayment._id}`);
        return res.status(409).json({ success: false, message: 'Payment ID already used' });
      }

      // Confirm booking and seats safely
      booking.paymentStatus = 'paid';
      booking.status = 'confirmed';
      booking.razorpayPaymentId = paymentId;
      booking.paidAt = new Date();
      booking.expiresAt = null;
      await booking.save();

      await SeatReservation.updateMany(
        { booking: booking._id },
        { $set: { status: 'confirmed', expiresAt: null } }
      );

      console.log(`[Webhook] Successfully confirmed booking ${booking.bookingRef} via webhook`);
    } else if (event === 'payment.failed' && payment) {
      // ── 4. Handle payment.failed ────────────────────────────────────────────
      const orderId = payment.order_id;
      const booking = await Booking.findOne({ razorpayOrderId: orderId });
      if (booking) {
        // Critical: Never downgrade a booking that was already paid/confirmed
        if (booking.paymentStatus === 'paid' || booking.status === 'confirmed') {
          console.warn(`[Webhook] Ignoring payment.failed for already paid booking ${booking._id}`);
          return res.status(200).json({ status: 'ok', message: 'Ignored failure for paid booking' });
        }
        if (booking.paymentStatus === 'pending') {
          booking.paymentStatus = 'failed';
          await booking.save();
          console.log(`[Webhook] Marked booking ${booking._id} paymentStatus as failed`);
        }
      }
    } else {
      console.log(`[Webhook] Ignored unhandled event: "${event}"`);
    }

    return res.status(200).json({ status: 'ok' });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /api/bookings/my
// @access Private
// ---------------------------------------------------------------------------
export const getMyBookings = async (req, res, next) => {
  try {
    // Purge any expired holds before listing
    await releaseExpiredHolds();

    const bookings = await Booking.find({ user: req.user._id })
      .populate('movie',    'title poster language certificate duration')
      .populate('theatre',  'name location city')
      .populate('screen',   'name screenType')
      .populate('showtime', 'startTime endTime pricing formattedTime')
      .sort({ createdAt: -1 })
      .lean({ virtuals: true });

    return res.status(200).json({ success: true, count: bookings.length, bookings });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /api/bookings/:id
// @access Private (owner only)
// ---------------------------------------------------------------------------
export const getBookingById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid booking ID format' });
    }

    const booking = await Booking.findById(id)
      .populate('movie',    'title poster language certificate duration')
      .populate('theatre',  'name location city address')
      .populate('screen',   'name screenType')
      .populate('showtime', 'startTime endTime pricing formattedTime')
      .lean({ virtuals: true });

    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this booking' });
    }

    return res.status(200).json({ success: true, booking });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /api/bookings/:id/cancel
// @access Private (owner only)
// Releases seat reservations so seats are freed immediately.
// ---------------------------------------------------------------------------
export const cancelBooking = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason = '' } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid booking ID format' });
    }

    const booking = await Booking.findById(id).populate('showtime', 'startTime status');
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    if (booking.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to cancel this booking' });
    }
    if (booking.status === 'cancelled') {
      return res.status(409).json({ success: false, message: 'Booking is already cancelled' });
    }
    if (new Date(booking.showtime.startTime) <= new Date()) {
      return res.status(400).json({ success: false, message: 'Cannot cancel a booking after the show has started' });
    }

    booking.status = 'cancelled';
    booking.cancelledAt = new Date();
    booking.cancellationReason = reason.toString().slice(0, 300);
    if (booking.paymentStatus === 'paid') booking.paymentStatus = 'refunded';

    await booking.save();

    // Release seat reservations so seats are immediately bookable again
    await SeatReservation.deleteMany({ booking: booking._id });

    return res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully',
      bookingRef: booking.bookingRef,
      cancelledAt: booking.cancelledAt,
    });
  } catch (err) {
    next(err);
  }
};
