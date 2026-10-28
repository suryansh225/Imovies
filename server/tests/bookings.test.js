import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import User from '../src/models/User.js';
import Movie from '../src/models/Movie.js';
import Theatre from '../src/models/Theatre.js';
import Screen from '../src/models/Screen.js';
import Showtime from '../src/models/Showtime.js';
import Booking from '../src/models/Booking.js';
import SeatReservation from '../src/models/SeatReservation.js';

async function runBookingTests() {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/imovies';
  const JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_12345';
  process.env.JWT_SECRET = JWT_SECRET;
  process.env.MONGODB_URI = MONGODB_URI;
  process.env.NODE_ENV = 'test';

  console.log('🔄 Starting Booking API test suite...');

  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  // Ensure unique indexes are built on all collections including SeatReservation
  await Promise.all([
    Booking.init(),
    Showtime.init(),
    Screen.init(),
    SeatReservation.init(),
  ]);

  const { default: app } = await import('../src/server.js');

  const PORT = 5008;
  const server = app.listen(PORT);
  const BASE = `http://127.0.0.1:${PORT}/api`;

  // ── Test data ───────────────────────────────────────────────────────────────
  const adminEmail  = `bk_admin_${Date.now()}@test.com`;
  const user1Email  = `bk_user1_${Date.now()}@test.com`;
  const user2Email  = `bk_user2_${Date.now()}@test.com`;
  let adminToken, user1Token, user2Token;
  let testMovie, testTheatre, testScreen, testShowtime;
  let createdBookingId;
  const toClean = { bookings: [], screens: [], theatres: [], showtimes: [], users: [] };

  try {
    // ── Create users ────────────────────────────────────────────────────────
    await User.deleteMany({ email: { $in: [adminEmail, user1Email, user2Email] } });
    const [admin, u1, u2] = await User.create([
      { name: 'BK Admin', email: adminEmail, password: 'AdminPass1!', role: 'admin' },
      { name: 'BK User 1', email: user1Email, password: 'UserPass1!', role: 'user' },
      { name: 'BK User 2', email: user2Email, password: 'UserPass1!', role: 'user' },
    ]);
    toClean.users.push(adminEmail, user1Email, user2Email);
    adminToken = jwt.sign({ id: admin._id }, JWT_SECRET, { expiresIn: '1h' });
    user1Token = jwt.sign({ id: u1._id },    JWT_SECRET, { expiresIn: '1h' });
    user2Token = jwt.sign({ id: u2._id },    JWT_SECRET, { expiresIn: '1h' });
    console.log('✅ Test users created');

    // ── Reuse or create a movie ─────────────────────────────────────────────
    testMovie = await Movie.findOne({ status: 'now_showing' });
    if (!testMovie) {
      testMovie = await Movie.create({
        title: 'BK Test Movie',
        description: 'desc',
        poster: 'https://placehold.co/400x600',
        backdrop: 'https://placehold.co/1200x600',
        genre: ['Action'],
        language: 'English',
        duration: '2h',
        releaseDate: '2026-01-01',
        director: 'Director',
        status: 'now_showing',
      });
    }

    // ── Create a dedicated test theatre + screen ────────────────────────────
    testTheatre = await Theatre.create({
      name: `BK Test Theatre ${Date.now()}`,
      address: '1 Test St',
      city: 'Testville',
    });
    toClean.theatres.push(testTheatre._id);

    testScreen = await Screen.create({
      theatre: testTheatre._id,
      name: 'Screen BK-1',
      screenType: 'Standard',
      seatLayout: { premium: ['A'], gold: ['B'], silver: ['C', 'D'] },
      columns: 5,
    });
    toClean.screens.push(testScreen._id);

    // Future showtime (2 days from now, 3h long)
    const startTime = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const endTime   = new Date(startTime.getTime() + 3 * 60 * 60 * 1000);

    testShowtime = await Showtime.create({
      movie: testMovie._id,
      theatre: testTheatre._id,
      screen: testScreen._id,
      startTime,
      endTime,
      pricing: { silver: 200, gold: 300, premium: 450 },
    });
    toClean.showtimes.push(testShowtime._id);
    console.log('✅ Test theatre, screen, and showtime created');

    // ────────────────────────────────────────────────────────────────────────
    // Test 1: Seat availability endpoint (public)
    // ────────────────────────────────────────────────────────────────────────
    console.log('\n--- Test 1: GET /api/bookings/availability/:showtimeId ---');
    const resAvail = await fetch(`${BASE}/bookings/availability/${testShowtime._id}`);
    const dataAvail = await resAvail.json();
    console.log('Status:', resAvail.status, '(expected 200)');
    if (resAvail.status !== 200 || !dataAvail.success) throw new Error(`Availability endpoint failed: ${JSON.stringify(dataAvail)}`);
    const totalAvail = dataAvail.summary.available;
    console.log(`✅ Availability: ${totalAvail} seats available, ${dataAvail.summary.booked} booked`);

    // ────────────────────────────────────────────────────────────────────────
    // Test 2: Unauthenticated booking rejected (401)
    // ────────────────────────────────────────────────────────────────────────
    console.log('\n--- Test 2: Unauthenticated booking → 401 ---');
    const resNoAuth = await fetch(`${BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ showtimeId: testShowtime._id, seatIds: ['A1'] }),
    });
    console.log('Status:', resNoAuth.status, '(expected 401)');
    if (resNoAuth.status !== 401) throw new Error('Expected 401 for unauthenticated request');
    console.log('✅ Unauthenticated request correctly rejected');

    // ────────────────────────────────────────────────────────────────────────
    // Test 3: Invalid seat ID format rejected (400)
    // ────────────────────────────────────────────────────────────────────────
    console.log('\n--- Test 3: Invalid seat ID format → 400 ---');
    const resBadSeat = await fetch(`${BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user1Token}` },
      body: JSON.stringify({ showtimeId: testShowtime._id, seatIds: ['A1', 'bad-seat'] }),
    });
    console.log('Status:', resBadSeat.status, '(expected 400)');
    if (resBadSeat.status !== 400) throw new Error('Expected 400 for invalid seat format');
    console.log('✅ Invalid seat ID correctly rejected');

    // ────────────────────────────────────────────────────────────────────────
    // Test 4: Seat not in screen layout rejected (400)
    // ────────────────────────────────────────────────────────────────────────
    console.log('\n--- Test 4: Seat not in layout → 400 ---');
    const resOutOfLayout = await fetch(`${BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user1Token}` },
      body: JSON.stringify({ showtimeId: testShowtime._id, seatIds: ['Z1'] }),
    });
    console.log('Status:', resOutOfLayout.status, '(expected 400)');
    if (resOutOfLayout.status !== 400) throw new Error('Expected 400 for seat not in layout');
    console.log('✅ Seat outside layout correctly rejected');

    // ────────────────────────────────────────────────────────────────────────
    // Test 5: Duplicate seat IDs in same request rejected (400)
    // ────────────────────────────────────────────────────────────────────────
    console.log('\n--- Test 5: Duplicate seat IDs in same request → 400 ---');
    const resDupInReq = await fetch(`${BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user1Token}` },
      body: JSON.stringify({ showtimeId: testShowtime._id, seatIds: ['A1', 'A1'] }),
    });
    console.log('Status:', resDupInReq.status, '(expected 400)');
    if (resDupInReq.status !== 400) throw new Error('Expected 400 for duplicate seat IDs in request');
    console.log('✅ Duplicate seats in request correctly rejected');

    // ────────────────────────────────────────────────────────────────────────
    // Test 6: Valid booking — user 1 books A1 (premium) + B1 (gold)
    // ────────────────────────────────────────────────────────────────────────
    console.log('\n--- Test 6: Valid booking (user 1 books A1 + B1) ---');
    const resBook = await fetch(`${BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user1Token}` },
      body: JSON.stringify({ showtimeId: testShowtime._id, seatIds: ['A1', 'B1'] }),
    });
    const dataBook = await resBook.json();
    console.log('Status:', resBook.status, '(expected 201)');
    if (resBook.status !== 201 || !dataBook.success) throw new Error(`Booking creation failed: ${JSON.stringify(dataBook)}`);
    createdBookingId = dataBook.booking._id;
    toClean.bookings.push(createdBookingId);
    const expectedTotal = 450 + 300; // A=premium, B=gold
    if (dataBook.booking.totalAmount !== expectedTotal) {
      throw new Error(`Expected totalAmount ${expectedTotal}, got ${dataBook.booking.totalAmount}`);
    }
    console.log(`✅ Booking created: ref=${dataBook.booking.bookingRef}, total=₹${dataBook.booking.totalAmount}`);
    console.log(`   paymentStatus=${dataBook.booking.paymentStatus} (expected: pending)`);
    if (dataBook.booking.paymentStatus !== 'pending') throw new Error('Payment status should be pending');

    // ────────────────────────────────────────────────────────────────────────
    // Test 7: Availability updated — A1 and B1 now booked
    // ────────────────────────────────────────────────────────────────────────
    console.log('\n--- Test 7: Availability reflects confirmed booking ---');
    const resAvail2 = await fetch(`${BASE}/bookings/availability/${testShowtime._id}`);
    const dataAvail2 = await resAvail2.json();
    const bookedSeats = Object.values(dataAvail2.availability).flat().filter((s) => s.status === 'booked');
    console.log('Booked seats now:', bookedSeats.map((s) => s.seatId));
    if (!bookedSeats.find((s) => s.seatId === 'A1') || !bookedSeats.find((s) => s.seatId === 'B1')) {
      throw new Error('A1 or B1 not shown as booked in availability');
    }
    console.log('✅ Availability correctly shows A1 and B1 as booked');

    // ────────────────────────────────────────────────────────────────────────
    // Test 8: Duplicate seat booking → 409 Conflict
    // ────────────────────────────────────────────────────────────────────────
    console.log('\n--- Test 8: Duplicate seat booking → 409 Conflict ---');
    const resDup = await fetch(`${BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user2Token}` },
      body: JSON.stringify({ showtimeId: testShowtime._id, seatIds: ['A1'] }),
    });
    const dataDup = await resDup.json();
    console.log('Status:', resDup.status, '(expected 409)');
    if (resDup.status !== 409) throw new Error(`Expected 409 for duplicate seat, got ${resDup.status}: ${JSON.stringify(dataDup)}`);
    console.log('✅ Duplicate seat correctly rejected with 409:', dataDup.message);

    // ────────────────────────────────────────────────────────────────────────
    // Test 9: Different users booking different seats concurrently
    // ────────────────────────────────────────────────────────────────────────
    console.log('\n--- Test 9: Concurrent booking of distinct seats (User 1 books C2, User 2 books C3) ---');
    const distinctRequests = [
      fetch(`${BASE}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user1Token}` },
        body: JSON.stringify({ showtimeId: testShowtime._id, seatIds: ['C2'] }),
      }),
      fetch(`${BASE}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user2Token}` },
        body: JSON.stringify({ showtimeId: testShowtime._id, seatIds: ['C3'] }),
      }),
    ];
    const distinctResponses = await Promise.all(distinctRequests);
    const [dRes1, dRes2] = await Promise.all([distinctResponses[0].json(), distinctResponses[1].json()]);
    console.log('User 1 status:', distinctResponses[0].status, 'User 2 status:', distinctResponses[1].status);
    if (distinctResponses[0].status !== 201 || distinctResponses[1].status !== 201) {
      throw new Error('Both distinct seat bookings should succeed with 201');
    }
    toClean.bookings.push(dRes1.booking._id, dRes2.booking._id);
    console.log('✅ Distinct seat concurrent bookings both succeeded');

    // ────────────────────────────────────────────────────────────────────────
    // Test 10: Simultaneous race condition for exact same seat (atomic mutual exclusion)
    // ────────────────────────────────────────────────────────────────────────
    console.log('\n--- Test 10: Simultaneous race condition for exact same seat (C1) ---');
    const raceRequests = [
      fetch(`${BASE}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user1Token}` },
        body: JSON.stringify({ showtimeId: testShowtime._id, seatIds: ['C1'] }),
      }),
      fetch(`${BASE}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user2Token}` },
        body: JSON.stringify({ showtimeId: testShowtime._id, seatIds: ['C1'] }),
      }),
    ];
    const raceResponses = await Promise.all(raceRequests);
    const raceResults = await Promise.all(raceResponses.map(async (r) => ({
      status: r.status,
      data: await r.json(),
    })));

    const successes = raceResults.filter((r) => r.status === 201);
    const conflicts = raceResults.filter((r) => r.status === 409);
    console.log('Race result statuses:', raceResults.map((r) => r.status));

    if (successes.length !== 1 || conflicts.length !== 1) {
      throw new Error(`Concurrency failure! Expected exactly 1 success (201) and 1 conflict (409). Got: ${successes.length} success, ${conflicts.length} conflict.`);
    }
    toClean.bookings.push(successes[0].data.booking._id);
    console.log('✅ Database-enforced atomic uniqueness verified! Exactly 1 succeeded (201) and 1 rejected (409)');

    // ────────────────────────────────────────────────────────────────────────
    // Test 11: GET /api/bookings/my — user 1 sees their booking
    // ────────────────────────────────────────────────────────────────────────
    console.log('\n--- Test 11: GET /api/bookings/my ---');
    const resMyBook = await fetch(`${BASE}/bookings/my`, {
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    const dataMyBook = await resMyBook.json();
    console.log('Status:', resMyBook.status, '(expected 200)');
    if (resMyBook.status !== 200 || !dataMyBook.bookings) throw new Error('Failed to fetch my bookings');
    const found = dataMyBook.bookings.find((b) => b._id === createdBookingId);
    if (!found) throw new Error('Created booking not found in my bookings');
    console.log(`✅ User 1 sees ${dataMyBook.count} booking(s), correct booking found`);

    // ────────────────────────────────────────────────────────────────────────
    // Test 12: Ownership check — user 2 cannot see user 1's booking (403)
    // ────────────────────────────────────────────────────────────────────────
    console.log('\n--- Test 12: Ownership check — user 2 cannot see user 1\'s booking ---');
    const resOtherBook = await fetch(`${BASE}/bookings/${createdBookingId}`, {
      headers: { Authorization: `Bearer ${user2Token}` },
    });
    console.log('Status:', resOtherBook.status, '(expected 403)');
    if (resOtherBook.status !== 403) throw new Error('Expected 403 for cross-user access');
    console.log('✅ Cross-user booking access correctly rejected with 403');

    // ────────────────────────────────────────────────────────────────────────
    // Test 13: User 1 fetches their own booking by ID
    // ────────────────────────────────────────────────────────────────────────
    console.log('\n--- Test 13: User 1 fetches their own booking by ID ---');
    const resOwnBook = await fetch(`${BASE}/bookings/${createdBookingId}`, {
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    const dataOwnBook = await resOwnBook.json();
    console.log('Status:', resOwnBook.status, '(expected 200)');
    if (resOwnBook.status !== 200 || !dataOwnBook.booking) throw new Error('Failed to fetch own booking by ID');
    console.log('✅ Own booking fetched successfully, ref:', dataOwnBook.booking.bookingRef);

    // ────────────────────────────────────────────────────────────────────────
    // Test 14: User 2 cannot cancel user 1's booking (403)
    // ────────────────────────────────────────────────────────────────────────
    console.log('\n--- Test 14: User 2 cannot cancel user 1\'s booking ---');
    const resOtherCancel = await fetch(`${BASE}/bookings/${createdBookingId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user2Token}` },
      body: JSON.stringify({ reason: 'Unauthorized' }),
    });
    console.log('Status:', resOtherCancel.status, '(expected 403)');
    if (resOtherCancel.status !== 403) throw new Error('Expected 403 for cross-user cancel');
    console.log('✅ Cross-user cancellation correctly rejected');

    // ────────────────────────────────────────────────────────────────────────
    // Test 15: User 1 cancels their own booking
    // ────────────────────────────────────────────────────────────────────────
    console.log('\n--- Test 15: User 1 cancels their own booking ---');
    const resCancel = await fetch(`${BASE}/bookings/${createdBookingId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user1Token}` },
      body: JSON.stringify({ reason: 'Plans changed' }),
    });
    const dataCancel = await resCancel.json();
    console.log('Status:', resCancel.status, '(expected 200)');
    if (resCancel.status !== 200 || !dataCancel.success) throw new Error(`Cancel failed: ${JSON.stringify(dataCancel)}`);
    console.log('✅ Booking cancelled:', dataCancel.bookingRef, 'at', dataCancel.cancelledAt);

    // ────────────────────────────────────────────────────────────────────────
    // Test 16: Double-cancel rejected (409)
    // ────────────────────────────────────────────────────────────────────────
    console.log('\n--- Test 16: Double-cancel → 409 ---');
    const resDoubleCancel = await fetch(`${BASE}/bookings/${createdBookingId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user1Token}` },
      body: JSON.stringify({ reason: 'Again' }),
    });
    console.log('Status:', resDoubleCancel.status, '(expected 409)');
    if (resDoubleCancel.status !== 409) throw new Error('Expected 409 for double-cancel');
    console.log('✅ Double-cancel correctly rejected with 409');

    // ────────────────────────────────────────────────────────────────────────
    // Test 17: Cancelled seats are immediately released and re-bookable
    // ────────────────────────────────────────────────────────────────────────
    console.log('\n--- Test 17: Cancelled seats (A1, B1) released and re-bookable ---');
    const resAvail3 = await fetch(`${BASE}/bookings/availability/${testShowtime._id}`);
    const dataAvail3 = await resAvail3.json();
    const stillBooked = Object.values(dataAvail3.availability).flat().filter((s) => s.status === 'booked');
    if (stillBooked.find((s) => s.seatId === 'A1' || s.seatId === 'B1')) {
      throw new Error('A1 or B1 still shown as booked after cancellation');
    }
    console.log('✅ Cancelled seats show as available in availability check');

    // Re-book A1 by User 2 to prove re-bookability
    const resRebook = await fetch(`${BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user2Token}` },
      body: JSON.stringify({ showtimeId: testShowtime._id, seatIds: ['A1'] }),
    });
    console.log('Re-book status:', resRebook.status, '(expected 201)');
    if (resRebook.status !== 201) throw new Error('Cancelled seat A1 could not be re-booked');
    const dataRebook = await resRebook.json();
    toClean.bookings.push(dataRebook.booking._id);
    console.log('✅ Cancelled seat A1 successfully re-booked by User 2');

    console.log('\n==========================================');
    console.log('🎉 ALL 17 BOOKING CONCURRENCY TESTS PASSED!');
    console.log('==========================================');
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exitCode = 1;
  } finally {
    console.log('\n🧹 Cleaning up test data...');
    try {
      if (toClean.bookings.length) {
        await Booking.deleteMany({ _id: { $in: toClean.bookings } });
        await SeatReservation.deleteMany({ booking: { $in: toClean.bookings } });
      }
      if (testShowtime) {
        await SeatReservation.deleteMany({ showtime: testShowtime._id });
        await Showtime.findByIdAndDelete(testShowtime._id);
      }
      if (toClean.screens.length)   await Screen.deleteMany({ _id: { $in: toClean.screens } });
      if (toClean.theatres.length)  await Theatre.deleteMany({ _id: { $in: toClean.theatres } });
      if (toClean.users.length)     await User.deleteMany({ email: { $in: toClean.users } });
    } catch (cleanErr) {
      console.warn('Cleanup error (ignored):', cleanErr.message);
    }
    server.close();
    await mongoose.connection.close();
    process.exit(process.exitCode || 0);
  }
}

runBookingTests();
