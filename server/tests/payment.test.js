/**
 * iMovies — Payment Integration Tests
 *
 * Tests cover:
 *  1.  verifyRazorpaySignature — valid, invalid secret, tampered fields, missing args
 *  2.  verifyRazorpayWebhookSignature — Buffer input, string input, tampered body, missing secret
 *  3.  POST /:id/payment/create-order — 503 when keys not configured, 404, 410 expired, 403 wrong user
 *  4.  POST /:id/payment/verify — valid HMAC, bad sig, already paid, order mismatch, duplicate paymentId,
 *                                  late payment (no SeatReservation), cancelled booking, wrong user
 *  5.  POST /payment/webhook — missing header, invalid sig, payment.captured, amount mismatch,
 *                               currency mismatch, expired booking/released seats, cancelled booking,
 *                               duplicate paymentId collision, duplicate delivery (idempotent),
 *                               conflicting payment.failed on paid booking (no downgrade), payment.failed on pending,
 *                               unknown event
 *  6.  Seat hold concurrency — two simultaneous attempts to reserve the same seat for same showtime
 *
 * Port: 5009 (isolated from other test suites)
 */

import mongoose from 'mongoose';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import User from '../src/models/User.js';
import Movie from '../src/models/Movie.js';
import Theatre from '../src/models/Theatre.js';
import Screen from '../src/models/Screen.js';
import Showtime from '../src/models/Showtime.js';
import Booking from '../src/models/Booking.js';
import SeatReservation from '../src/models/SeatReservation.js';
import {
  verifyRazorpaySignature,
  verifyRazorpayWebhookSignature,
} from '../src/services/razorpayService.js';

// ─── Test constants ────────────────────────────────────────────────────────────
const PORT = 5009;
const WEBHOOK_SECRET = 'test_webhook_secret_payment_suite';
const KEY_SECRET     = 'test_key_secret_payment_suite';

// ─── HMAC helpers ──────────────────────────────────────────────────────────────
const makePaymentSig = (orderId, paymentId, secret = KEY_SECRET) =>
  crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');

const makeWebhookSig = (rawBody, secret = WEBHOOK_SECRET) => {
  const buf = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody);
  return crypto.createHmac('sha256', secret).update(buf).digest('hex');
};

// ─── HTTP helper ───────────────────────────────────────────────────────────────
const BASE = `http://127.0.0.1:${PORT}/api`;

async function api(method, path, { body, token, rawBuffer } = {}) {
  const headers = {};
  let reqBody;
  if (rawBuffer) {
    headers['Content-Type'] = 'application/json';
    reqBody = rawBuffer;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    reqBody = JSON.stringify(body);
  }
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { method, headers, body: reqBody });
  let data;
  try { data = await res.json(); } catch { data = {}; }
  return { status: res.status, data };
}

// ─── Assert helper ─────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(condition, name, detail = '') {
  if (condition) {
    console.log(`  ✓  ${name}`);
    passed++;
  } else {
    console.error(`  ✗  ${name}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

// ─── Setup helpers ─────────────────────────────────────────────────────────────
async function seedData(JWT_SECRET) {
  const movie = await Movie.create({
    title: `Pay Movie ${Date.now()}`,
    description: 'Payment test movie',
    genre: ['Action'],
    language: 'English',
    duration: 120,
    director: 'Test Director',
    backdrop: 'https://via.placeholder.com/1200x600',
    releaseDate: new Date(),
    certificate: 'U',
    status: 'now_showing',
    poster: 'https://via.placeholder.com/300x450',
  });

  const theatre = await Theatre.create({
    name: `Pay Theatre ${Date.now()}`,
    address: '1 Pay St',
    city: 'Testville',
    isActive: true,
  });

  const screen = await Screen.create({
    theatre: theatre._id,
    name: 'Screen P1',
    screenType: 'Standard',
    totalSeats: 30,
    columns: 10,
    seatLayout: { premium: ['A', 'B'], gold: ['C', 'D'], silver: ['E', 'F', 'G'] },
  });

  const startTime = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const endTime   = new Date(startTime.getTime() + 2 * 60 * 60 * 1000);

  const showtime = await Showtime.create({
    movie: movie._id,
    theatre: theatre._id,
    screen: screen._id,
    startTime,
    endTime,
    pricing: { premium: 350, gold: 250, silver: 150 },
    isActive: true,
    status: 'scheduled',
  });

  const user1 = await User.create({
    name: 'Pay User 1',
    email: `pay1_${Date.now()}@test.com`,
    password: 'UserPass1!',
    role: 'user',
  });
  const user2 = await User.create({
    name: 'Pay User 2',
    email: `pay2_${Date.now()}@test.com`,
    password: 'UserPass1!',
    role: 'user',
  });

  const token1 = jwt.sign({ id: user1._id }, JWT_SECRET, { expiresIn: '2h' });
  const token2 = jwt.sign({ id: user2._id }, JWT_SECRET, { expiresIn: '2h' });

  return { movie, theatre, screen, showtime, user1, user2, token1, token2 };
}

async function createHeldBooking(data, userId, seatIds = ['A1'], expiresInMs = 10 * 60 * 1000) {
  const { showtime, movie, theatre, screen } = data;
  const expiresAt = new Date(Date.now() + expiresInMs);

  const booking = await Booking.create({
    user: userId,
    showtime: showtime._id,
    movie: movie._id,
    theatre: theatre._id,
    screen: screen._id,
    seats: seatIds.map((s) => ({
      seatId: s,
      row: s[0],
      number: parseInt(s.slice(1), 10),
      category: 'premium',
      price: 350,
    })),
    totalAmount: 350 * seatIds.length,
    status: 'pending_payment',
    paymentStatus: 'pending',
    expiresAt,
  });

  await SeatReservation.insertMany(
    seatIds.map((sid) => ({
      showtime: showtime._id,
      seatId: sid,
      user: userId,
      status: 'held',
      booking: booking._id,
      expiresAt,
    }))
  );

  return booking;
}

// =============================================================================
async function runPaymentTests() {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/imovies';
  const JWT_SECRET  = process.env.JWT_SECRET  || 'test_jwt_secret_key_12345';

  process.env.JWT_SECRET            = JWT_SECRET;
  process.env.MONGODB_URI           = MONGODB_URI;
  process.env.NODE_ENV              = 'test';
  process.env.RAZORPAY_KEY_SECRET   = KEY_SECRET;
  process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
  // KEY_ID intentionally absent so getRazorpayInstance() returns null (no live API calls)
  delete process.env.RAZORPAY_KEY_ID;

  console.log('\n💳 Starting Payment test suite...\n');

  await mongoose.connect(MONGODB_URI);
  console.log('✔  Connected to MongoDB');

  await Promise.all([Booking.init(), SeatReservation.init()]);

  const { default: app } = await import('../src/server.js');
  const server = app.listen(PORT);
  console.log(`✔  Server listening on port ${PORT}\n`);

  const D = await seedData(JWT_SECRET);
  console.log('✔  Seed data created\n');

  // ──────────────────────────────────────────────────────────────────────────
  // Section 1: razorpayService unit tests
  // ──────────────────────────────────────────────────────────────────────────
  console.log('━━━ 1. verifyRazorpaySignature unit tests ━━━');
  {
    const orderId   = 'order_unit_test';
    const paymentId = 'pay_unit_test';
    const goodSig   = makePaymentSig(orderId, paymentId);

    assert(
      verifyRazorpaySignature(orderId, paymentId, goodSig),
      'correct signature returns true'
    );
    assert(
      !verifyRazorpaySignature(orderId, paymentId, makePaymentSig(orderId, paymentId, 'wrong')),
      'wrong secret returns false'
    );
    assert(
      !verifyRazorpaySignature('order_tampered', paymentId, goodSig),
      'tampered order ID returns false'
    );
    assert(
      !verifyRazorpaySignature(orderId, 'pay_tampered', goodSig),
      'tampered payment ID returns false'
    );
    assert(
      !verifyRazorpaySignature(null, paymentId, goodSig),
      'null orderId returns false'
    );
    assert(
      !verifyRazorpaySignature(orderId, null, goodSig),
      'null paymentId returns false'
    );
    assert(
      !verifyRazorpaySignature(orderId, paymentId, null),
      'null signature returns false'
    );

    const saved = process.env.RAZORPAY_KEY_SECRET;
    delete process.env.RAZORPAY_KEY_SECRET;
    assert(
      !verifyRazorpaySignature(orderId, paymentId, goodSig),
      'missing KEY_SECRET returns false'
    );
    process.env.RAZORPAY_KEY_SECRET = saved;
  }

  console.log('\n━━━ 2. verifyRazorpayWebhookSignature unit tests ━━━');
  {
    const body   = JSON.stringify({ event: 'payment.captured' });
    const bufBody = Buffer.from(body);
    const goodSig = makeWebhookSig(bufBody);

    assert(
      verifyRazorpayWebhookSignature(bufBody, goodSig),
      'Buffer body with correct sig returns true'
    );
    assert(
      verifyRazorpayWebhookSignature(body, goodSig),
      'string body with correct sig returns true'
    );
    assert(
      !verifyRazorpayWebhookSignature(bufBody, makeWebhookSig(bufBody, 'wrong')),
      'wrong webhook secret returns false'
    );
    assert(
      !verifyRazorpayWebhookSignature(Buffer.from('tampered_body'), goodSig),
      'tampered body returns false'
    );

    const saved = process.env.RAZORPAY_WEBHOOK_SECRET;
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    assert(
      !verifyRazorpayWebhookSignature(bufBody, goodSig),
      'missing WEBHOOK_SECRET returns false'
    );
    process.env.RAZORPAY_WEBHOOK_SECRET = saved;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Section 2: POST /:id/payment/create-order
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n━━━ 3. POST /:id/payment/create-order ━━━');
  {
    // 503 when KEY_ID not set
    const b = await createHeldBooking(D, D.user1._id, ['A2']);
    const r = await api('POST', `/bookings/${b._id}/payment/create-order`, { token: D.token1 });
    if (r.status !== 503) {
      console.log('DEBUG create-order failure:', r.status, r.data);
    }
    assert(r.status === 503, 'returns 503 when RAZORPAY_KEY_ID not configured', `got ${r.status}`);

    // 404 for unknown booking
    const fakeId = new mongoose.Types.ObjectId();
    const r2 = await api('POST', `/bookings/${fakeId}/payment/create-order`, { token: D.token1 });
    assert(r2.status === 404, 'returns 404 for non-existent booking', `got ${r2.status}`);

    // 410 for expired hold
    const expired = await Booking.create({
      user: D.user1._id,
      showtime: D.showtime._id,
      movie: D.movie._id,
      theatre: D.theatre._id,
      screen: D.screen._id,
      seats: [{ seatId: 'B1', row: 'B', number: 1, category: 'premium', price: 350 }],
      totalAmount: 350,
      status: 'pending_payment',
      paymentStatus: 'pending',
      expiresAt: new Date(Date.now() - 1000),
    });
    const r3 = await api('POST', `/bookings/${expired._id}/payment/create-order`, { token: D.token1 });
    assert(r3.status === 410, 'returns 410 for expired seat hold', `got ${r3.status}`);

    // 403 for wrong user
    const r4 = await api('POST', `/bookings/${b._id}/payment/create-order`, { token: D.token2 });
    assert(r4.status === 403, 'returns 403 for booking owned by different user', `got ${r4.status}`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Section 3: POST /:id/payment/verify
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n━━━ 4. POST /:id/payment/verify ━━━');
  {
    // (a) Bad signature → 400
    const bBad = await createHeldBooking(D, D.user1._id, ['A3']);
    bBad.razorpayOrderId = 'order_bad_sig';
    await bBad.save();

    const r1 = await api('POST', `/bookings/${bBad._id}/payment/verify`, {
      token: D.token1,
      body: {
        razorpay_order_id:  'order_bad_sig',
        razorpay_payment_id: 'pay_bad_sig',
        razorpay_signature:  'definitely_wrong',
      },
    });
    assert(r1.status === 400, '(a) invalid signature → 400', `got ${r1.status}`);

    // (b) Valid HMAC → 200, booking confirmed
    const bGood = await createHeldBooking(D, D.user1._id, ['A4']);
    const ordId = `order_good_${Date.now()}`;
    const payId = `pay_good_${Date.now()}`;
    bGood.razorpayOrderId = ordId;
    await bGood.save();
    const sig = makePaymentSig(ordId, payId);

    const r2 = await api('POST', `/bookings/${bGood._id}/payment/verify`, {
      token: D.token1,
      body: {
        razorpay_order_id:  ordId,
        razorpay_payment_id: payId,
        razorpay_signature:  sig,
      },
    });
    assert(r2.status === 200, '(b) valid signature → 200', `got ${r2.status}`);
    assert(r2.data?.booking?.paymentStatus === 'paid',   '(b) paymentStatus becomes paid');
    assert(r2.data?.booking?.status === 'confirmed',     '(b) status becomes confirmed');

    // (c) Already paid → 200 idempotent
    const bAlready = await Booking.create({
      user: D.user1._id,
      showtime: D.showtime._id,
      movie: D.movie._id,
      theatre: D.theatre._id,
      screen: D.screen._id,
      seats: [{ seatId: 'A5', row: 'A', number: 5, category: 'premium', price: 350 }],
      totalAmount: 350,
      status: 'confirmed',
      paymentStatus: 'paid',
      razorpayOrderId: `order_already_${Date.now()}`,
      razorpayPaymentId: `pay_already_${Date.now()}`,
    });
    const r3 = await api('POST', `/bookings/${bAlready._id}/payment/verify`, {
      token: D.token1,
      body: {
        razorpay_order_id:  bAlready.razorpayOrderId,
        razorpay_payment_id: bAlready.razorpayPaymentId,
        razorpay_signature:  makePaymentSig(bAlready.razorpayOrderId, bAlready.razorpayPaymentId),
      },
    });
    assert(r3.status === 200, '(c) already paid → 200 idempotent', `got ${r3.status}`);

    // (d) Order ID mismatch → 400
    const bMism = await createHeldBooking(D, D.user1._id, ['B2']);
    bMism.razorpayOrderId = 'order_correct';
    await bMism.save();
    const r4 = await api('POST', `/bookings/${bMism._id}/payment/verify`, {
      token: D.token1,
      body: {
        razorpay_order_id:  'order_wrong',
        razorpay_payment_id: 'pay_mism',
        razorpay_signature:  makePaymentSig('order_wrong', 'pay_mism'),
      },
    });
    assert(r4.status === 400, '(d) order ID mismatch → 400', `got ${r4.status}`);

    // (e) Duplicate payment ID across bookings → 409
    const reusedPayId = `pay_reused_${Date.now()}`;
    const reusedOrdId = `order_reused_${Date.now()}`;
    await Booking.create({
      user: D.user1._id,
      showtime: D.showtime._id,
      movie: D.movie._id,
      theatre: D.theatre._id,
      screen: D.screen._id,
      seats: [{ seatId: 'C1', row: 'C', number: 1, category: 'gold', price: 250 }],
      totalAmount: 250,
      status: 'confirmed',
      paymentStatus: 'paid',
      razorpayOrderId: reusedOrdId,
      razorpayPaymentId: reusedPayId,
    });
    const bDup = await createHeldBooking(D, D.user1._id, ['C2']);
    const dupOrdId = `order_dup_${Date.now()}`;
    bDup.razorpayOrderId = dupOrdId;
    await bDup.save();
    const r5 = await api('POST', `/bookings/${bDup._id}/payment/verify`, {
      token: D.token1,
      body: {
        razorpay_order_id:  dupOrdId,
        razorpay_payment_id: reusedPayId,
        razorpay_signature:  makePaymentSig(dupOrdId, reusedPayId),
      },
    });
    assert(r5.status === 409, '(e) duplicate payment ID → 409', `got ${r5.status}`);

    // (f) Late payment — seat reservations already released → 410
    const bLate = await createHeldBooking(D, D.user1._id, ['D1']);
    const lateOrdId = `order_late_${Date.now()}`;
    const latePayId = `pay_late_${Date.now()}`;
    bLate.razorpayOrderId = lateOrdId;
    await bLate.save();
    await SeatReservation.deleteMany({ booking: bLate._id }); // simulate expired + released
    const r6 = await api('POST', `/bookings/${bLate._id}/payment/verify`, {
      token: D.token1,
      body: {
        razorpay_order_id:  lateOrdId,
        razorpay_payment_id: latePayId,
        razorpay_signature:  makePaymentSig(lateOrdId, latePayId),
      },
    });
    assert(r6.status === 410, '(f) late payment (no SeatReservation) → 410', `got ${r6.status}`);

    // (g) Cancelled booking → 400
    const bCan = await Booking.create({
      user: D.user1._id,
      showtime: D.showtime._id,
      movie: D.movie._id,
      theatre: D.theatre._id,
      screen: D.screen._id,
      seats: [{ seatId: 'E1', row: 'E', number: 1, category: 'silver', price: 150 }],
      totalAmount: 150,
      status: 'cancelled',
      paymentStatus: 'pending',
      razorpayOrderId: `order_can_${Date.now()}`,
    });
    const r7 = await api('POST', `/bookings/${bCan._id}/payment/verify`, {
      token: D.token1,
      body: {
        razorpay_order_id:  bCan.razorpayOrderId,
        razorpay_payment_id: `pay_can_${Date.now()}`,
        razorpay_signature:  makePaymentSig(bCan.razorpayOrderId, `pay_can_x`),
      },
    });
    assert([400, 410].includes(r7.status), '(g) cancelled booking → 400/410', `got ${r7.status}`);

    // (h) Wrong user → 403
    const bWU = await createHeldBooking(D, D.user1._id, ['F1']);
    const wuOrdId = `order_wu_${Date.now()}`;
    bWU.razorpayOrderId = wuOrdId;
    await bWU.save();
    const r8 = await api('POST', `/bookings/${bWU._id}/payment/verify`, {
      token: D.token2,
      body: {
        razorpay_order_id:  wuOrdId,
        razorpay_payment_id: `pay_wu_${Date.now()}`,
        razorpay_signature:  makePaymentSig(wuOrdId, 'any'),
      },
    });
    assert(r8.status === 403, '(h) wrong user → 403', `got ${r8.status}`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Section 4: POST /payment/webhook
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n━━━ 5. POST /payment/webhook ━━━');
  {
    // (a) Missing signature header → 400
    const rawBody = Buffer.from(JSON.stringify({ event: 'payment.captured' }));
    const r1raw = await fetch(`${BASE}/bookings/payment/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: rawBody,
    });
    assert(r1raw.status === 400, '(a) missing sig header → 400', `got ${r1raw.status}`);

    // (b) Invalid signature → 400
    const r2raw = await fetch(`${BASE}/bookings/payment/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': 'bad_sig' },
      body: rawBody,
    });
    assert(r2raw.status === 400, '(b) invalid sig → 400', `got ${r2raw.status}`);

    // (c) payment.captured → booking confirmed
    const bCapt = await createHeldBooking(D, D.user1._id, ['A8']);
    const captOrdId = `order_wh_cap_${Date.now()}`;
    const captPayId = `pay_wh_cap_${Date.now()}`;
    bCapt.razorpayOrderId = captOrdId;
    await bCapt.save();

    const captPayload = {
      event: 'payment.captured',
      payload: { payment: { entity: { id: captPayId, order_id: captOrdId, status: 'captured', amount: 35000, currency: 'INR' } } },
    };
    const captBuf = Buffer.from(JSON.stringify(captPayload));
    const captSig = makeWebhookSig(captBuf);

    const r3raw = await fetch(`${BASE}/bookings/payment/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': captSig },
      body: captBuf,
    });
    assert(r3raw.status === 200, '(c) payment.captured → 200', `got ${r3raw.status}`);
    const updatedCapt = await Booking.findById(bCapt._id);
    assert(updatedCapt.paymentStatus === 'paid',  '(c) booking paymentStatus = paid');
    assert(updatedCapt.status === 'confirmed',     '(c) booking status = confirmed');
    assert(updatedCapt.razorpayPaymentId === captPayId, '(c) paymentId stored');

    // (d) Amount mismatch on webhook → 400 rejected
    const bAmountMism = await createHeldBooking(D, D.user1._id, ['A9']);
    const mismOrdId = `order_mism_amount_${Date.now()}`;
    bAmountMism.razorpayOrderId = mismOrdId;
    await bAmountMism.save();

    const mismAmountPayload = {
      event: 'payment.captured',
      payload: { payment: { entity: { id: `pay_mism_${Date.now()}`, order_id: mismOrdId, amount: 99999, currency: 'INR' } } },
    };
    const mismAmountBuf = Buffer.from(JSON.stringify(mismAmountPayload));
    const mismAmountSig = makeWebhookSig(mismAmountBuf);

    const rMismAmt = await fetch(`${BASE}/bookings/payment/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': mismAmountSig },
      body: mismAmountBuf,
    });
    assert(rMismAmt.status === 400, '(d) amount mismatch → 400', `got ${rMismAmt.status}`);

    // (e) Currency mismatch on webhook → 400 rejected
    const bCurrMism = await createHeldBooking(D, D.user1._id, ['A10']);
    const currOrdId = `order_mism_curr_${Date.now()}`;
    bCurrMism.razorpayOrderId = currOrdId;
    await bCurrMism.save();

    const mismCurrPayload = {
      event: 'payment.captured',
      payload: { payment: { entity: { id: `pay_currmism_${Date.now()}`, order_id: currOrdId, amount: 35000, currency: 'USD' } } },
    };
    const mismCurrBuf = Buffer.from(JSON.stringify(mismCurrPayload));
    const mismCurrSig = makeWebhookSig(mismCurrBuf);

    const rMismCurr = await fetch(`${BASE}/bookings/payment/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': mismCurrSig },
      body: mismCurrBuf,
    });
    assert(rMismCurr.status === 400, '(e) currency mismatch → 400', `got ${rMismCurr.status}`);

    // (f) Webhook for expired hold / released seats → 410 rejected
    const bExpSeats = await createHeldBooking(D, D.user1._id, ['B3']);
    const expOrdId = `order_exp_seats_${Date.now()}`;
    bExpSeats.razorpayOrderId = expOrdId;
    await bExpSeats.save();
    await SeatReservation.deleteMany({ booking: bExpSeats._id }); // simulate hold expiry

    const expPayload = {
      event: 'payment.captured',
      payload: { payment: { entity: { id: `pay_exp_${Date.now()}`, order_id: expOrdId, amount: 35000, currency: 'INR' } } },
    };
    const expBuf = Buffer.from(JSON.stringify(expPayload));
    const expSig = makeWebhookSig(expBuf);

    const rExp = await fetch(`${BASE}/bookings/payment/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': expSig },
      body: expBuf,
    });
    assert(rExp.status === 410, '(f) expired hold/released seats → 410', `got ${rExp.status}`);

    // (g) Duplicate payment.captured delivery → idempotent 200, paymentId unchanged
    const alrPaidOrdId = `order_idem_${Date.now()}`;
    const bIdem = await Booking.create({
      user: D.user1._id,
      showtime: D.showtime._id,
      movie: D.movie._id,
      theatre: D.theatre._id,
      screen: D.screen._id,
      seats: [{ seatId: 'B5', row: 'B', number: 5, category: 'premium', price: 350 }],
      totalAmount: 350,
      status: 'confirmed',
      paymentStatus: 'paid',
      razorpayOrderId: alrPaidOrdId,
      razorpayPaymentId: `pay_idem_orig_${Date.now()}`,
      paidAt: new Date(),
    });
    const dupPayId = `pay_idem_dup_${Date.now()}`;
    const idemPayload = {
      event: 'payment.captured',
      payload: { payment: { entity: { id: dupPayId, order_id: alrPaidOrdId, status: 'captured', amount: 35000, currency: 'INR' } } },
    };
    const idemBuf = Buffer.from(JSON.stringify(idemPayload));
    const idemSig = makeWebhookSig(idemBuf);

    const r4raw = await fetch(`${BASE}/bookings/payment/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': idemSig },
      body: idemBuf,
    });
    assert(r4raw.status === 200, '(g) duplicate webhook → 200 idempotent', `got ${r4raw.status}`);
    const refetchedIdem = await Booking.findById(bIdem._id);
    assert(refetchedIdem.razorpayPaymentId !== dupPayId, '(g) payment ID not overwritten on duplicate delivery');

    // (h) Conflicting payment.failed on already paid booking → does not downgrade
    const failConflictPayload = {
      event: 'payment.failed',
      payload: { payment: { entity: { id: `pay_fail_conf_${Date.now()}`, order_id: alrPaidOrdId } } },
    };
    const failConfBuf = Buffer.from(JSON.stringify(failConflictPayload));
    const failConfSig = makeWebhookSig(failConfBuf);

    const rFailConf = await fetch(`${BASE}/bookings/payment/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': failConfSig },
      body: failConfBuf,
    });
    assert(rFailConf.status === 200, '(h) conflicting payment.failed does not fail', `got ${rFailConf.status}`);
    const stillPaid = await Booking.findById(bIdem._id);
    assert(stillPaid.paymentStatus === 'paid', '(h) booking remains paid, not downgraded');

    // (i) payment.failed on pending booking → marks as failed
    const bFail = await createHeldBooking(D, D.user1._id, ['B4']);
    const failOrdId = `order_wh_fail_${Date.now()}`;
    bFail.razorpayOrderId = failOrdId;
    await bFail.save();

    const failPayload = {
      event: 'payment.failed',
      payload: { payment: { entity: { id: `pay_wh_fail_${Date.now()}`, order_id: failOrdId } } },
    };
    const failBuf = Buffer.from(JSON.stringify(failPayload));
    const failSig = makeWebhookSig(failBuf);

    const r5raw = await fetch(`${BASE}/bookings/payment/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': failSig },
      body: failBuf,
    });
    assert(r5raw.status === 200, '(i) payment.failed → 200', `got ${r5raw.status}`);
    const updatedFail = await Booking.findById(bFail._id);
    assert(updatedFail.paymentStatus === 'failed', '(i) paymentStatus = failed');

    // (j) Unknown event type → 200 graceful
    const unknownPayload = { event: 'refund.processed', payload: {} };
    const unknownBuf = Buffer.from(JSON.stringify(unknownPayload));
    const unknownSig = makeWebhookSig(unknownBuf);
    const r6raw = await fetch(`${BASE}/bookings/payment/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': unknownSig },
      body: unknownBuf,
    });
    assert(r6raw.status === 200, '(j) unknown event → 200 graceful', `got ${r6raw.status}`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Section 5: Concurrency test — two users competing for same seat
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n━━━ 6. Concurrency: Two users competing for same seat ━━━');
  {
    const targetSeat = 'B6';

    const req1 = api('POST', '/bookings', {
      token: D.token1,
      body: { showtimeId: D.showtime._id, seatIds: [targetSeat] },
    });
    const req2 = api('POST', '/bookings', {
      token: D.token2,
      body: { showtimeId: D.showtime._id, seatIds: [targetSeat] },
    });

    const [res1, res2] = await Promise.all([req1, req2]);
    const statuses = [res1.status, res2.status].sort();

    assert(
      statuses[0] === 201 && statuses[1] === 409,
      'Exactly one booking succeeds (201) and one fails (409)',
      `got ${res1.status} and ${res2.status}`
    );

    // Verify SeatReservation collection has exactly 1 entry for this seat
    const reservedCount = await SeatReservation.countDocuments({
      showtime: D.showtime._id,
      seatId: targetSeat,
    });
    assert(reservedCount === 1, 'Only one SeatReservation record exists in MongoDB');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Results
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`💳 Payment tests: ${passed} passed, ${failed} failed`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Cleanup
  await Booking.deleteMany({ showtime: D.showtime._id });
  await SeatReservation.deleteMany({ showtime: D.showtime._id });
  await User.deleteMany({ email: { $regex: /^pay[12]_/ } });
  await Movie.deleteMany({ _id: D.movie._id });
  await Theatre.deleteMany({ _id: D.theatre._id });
  await Screen.deleteMany({ _id: D.screen._id });
  await Showtime.deleteMany({ _id: D.showtime._id });

  server.close();
  await mongoose.disconnect();

  if (failed > 0) {
    console.error(`❌ ${failed} test(s) FAILED`);
    process.exit(1);
  } else {
    console.log('✅ All payment tests passed!');
    process.exit(0);
  }
}

runPaymentTests().catch((err) => {
  console.error('💥 Payment test suite crashed:', err);
  process.exit(1);
});
