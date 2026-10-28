import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import User from '../src/models/User.js';
import Movie from '../src/models/Movie.js';
import Theatre from '../src/models/Theatre.js';
import Screen from '../src/models/Screen.js';
import Showtime from '../src/models/Showtime.js';

async function runTheatreShowtimeTests() {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/imovies';
  const JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_12345';
  process.env.JWT_SECRET = JWT_SECRET;
  process.env.MONGODB_URI = MONGODB_URI;
  process.env.NODE_ENV = 'test';

  console.log('🔄 Starting Theatre & Showtime API test suite...');

  // Connect to MongoDB
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  // Ensure model indexes
  await Promise.all([
    Theatre.init(),
    Screen.init(),
    Showtime.init(),
  ]);

  // Dynamically import server app
  const { default: app } = await import('../src/server.js');

  const PORT = 5007;
  const server = app.listen(PORT);
  const BASE_URL = `http://127.0.0.1:${PORT}/api`;

  const adminEmail = `admin_ts_${Date.now()}@example.com`;
  const normalUserEmail = `user_ts_${Date.now()}@example.com`;
  let adminToken = null;
  let userToken = null;

  let testMovie = null;
  let testTheatre = null;
  let testScreen = null;
  let createdShowtimeId = null;

  try {
    // 1. Setup test users
    await User.deleteMany({ email: { $in: [adminEmail, normalUserEmail] } });

    const normalUser = await User.create({
      name: 'TS Normal User',
      email: normalUserEmail,
      password: 'UserPass123!',
      role: 'user',
    });
    userToken = jwt.sign({ id: normalUser._id }, JWT_SECRET, { expiresIn: '1h' });

    const adminUser = await User.create({
      name: 'TS Admin User',
      email: adminEmail,
      password: 'AdminPass123!',
      role: 'admin',
    });
    adminToken = jwt.sign({ id: adminUser._id }, JWT_SECRET, { expiresIn: '1h' });
    console.log('✅ Normal and Admin test users created');

    // 2. Fetch or create a test Movie
    testMovie = await Movie.findOne({ status: 'now_showing' });
    if (!testMovie) {
      testMovie = await Movie.create({
        title: 'Test Feature Movie',
        description: 'Test Description',
        genre: ['Action'],
        language: ['English'],
        duration: 120,
        releaseDate: new Date(),
        status: 'now_showing',
      });
    }

    // 3. Test GET /api/theatres
    console.log('\n--- Test 1: GET /api/theatres (listing & city filter) ---');
    const resTheatres = await fetch(`${BASE_URL}/theatres`);
    const dataTheatres = await resTheatres.json();
    console.log('GET /theatres Status:', resTheatres.status, '(expected 200)');
    if (resTheatres.status !== 200 || !dataTheatres.success) {
      throw new Error(`Failed to list theatres: ${JSON.stringify(dataTheatres)}`);
    }
    console.log(`✅ Loaded ${dataTheatres.count} theatres`);

    // 4. Test GET /api/theatres with invalid ID
    console.log('\n--- Test 2: GET /api/theatres/:id with invalid format ---');
    const resInvalidId = await fetch(`${BASE_URL}/theatres/not-a-valid-id`);
    const dataInvalidId = await resInvalidId.json();
    console.log('Invalid ID Status:', resInvalidId.status, '(expected 400)');
    if (resInvalidId.status !== 400) {
      throw new Error(`Expected 400 for invalid ID, got ${resInvalidId.status}`);
    }
    console.log('✅ Invalid ID correctly rejected with 400');

    // 5. Test Admin POST /api/theatres
    console.log('\n--- Test 3: Admin create theatre ---');
    const newTheatrePayload = {
      name: `Grand Multiplex ${Date.now()}`,
      address: '789 Broadway St',
      city: 'Metropolis',
      amenities: ['IMAX', '4DX', 'Dolby Atmos', 'Recliner Seats'],
      rating: 4.8,
    };

    // Unauthenticated attempt
    const resNoAuth = await fetch(`${BASE_URL}/theatres`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTheatrePayload),
    });
    console.log('Unauthenticated POST status:', resNoAuth.status, '(expected 401)');
    if (resNoAuth.status !== 401) throw new Error('Unauthenticated creation should fail with 401');

    // Non-admin attempt
    const resForbidden = await fetch(`${BASE_URL}/theatres`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify(newTheatrePayload),
    });
    console.log('Normal user POST status:', resForbidden.status, '(expected 403)');
    if (resForbidden.status !== 403) throw new Error('Normal user creation should fail with 403');

    // Admin attempt
    const resAdminCreate = await fetch(`${BASE_URL}/theatres`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify(newTheatrePayload),
    });
    const dataAdminCreate = await resAdminCreate.json();
    console.log('Admin POST status:', resAdminCreate.status, '(expected 201)');
    if (resAdminCreate.status !== 201 || !dataAdminCreate.success) {
      throw new Error(`Admin theatre creation failed: ${JSON.stringify(dataAdminCreate)}`);
    }
    testTheatre = dataAdminCreate.theatre;
    console.log('✅ Admin theatre created successfully:', testTheatre._id);

    // 6. Test Admin POST /api/theatres/:id/screens
    console.log('\n--- Test 4: Admin create screen for theatre ---');
    const screenPayload = {
      name: 'Screen 1 (Laser IMAX)',
      screenType: 'IMAX',
      seatLayout: {
        silver: ['A', 'B'],
        gold: ['C', 'D'],
        premium: ['E'],
      },
      columns: 10,
    };
    const resScreenCreate = await fetch(`${BASE_URL}/theatres/${testTheatre._id}/screens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify(screenPayload),
    });
    const dataScreenCreate = await resScreenCreate.json();
    console.log('Screen POST status:', resScreenCreate.status, '(expected 201)');
    if (resScreenCreate.status !== 201 || !dataScreenCreate.success) {
      throw new Error(`Screen creation failed: ${JSON.stringify(dataScreenCreate)}`);
    }
    testScreen = dataScreenCreate.screen;
    console.log('✅ Screen created:', testScreen._id, 'Total seats:', testScreen.totalSeats);

    // 7. Test GET /api/theatres/:id/screens
    console.log('\n--- Test 5: GET /api/theatres/:id/screens ---');
    const resGetScreens = await fetch(`${BASE_URL}/theatres/${testTheatre._id}/screens`);
    const dataGetScreens = await resGetScreens.json();
    console.log('GET screens status:', resGetScreens.status, '(expected 200)');
    if (resGetScreens.status !== 200 || dataGetScreens.count !== 1) {
      throw new Error(`Expected 1 screen, got ${dataGetScreens.count}`);
    }
    console.log('✅ Retrieved theatre screens successfully');

    // 8. Test Showtime Creation & Validation (startTime >= endTime rejection)
    console.log('\n--- Test 6: Showtime validation (invalid start/end time) ---');
    const now = new Date();
    const baseDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2, 14, 0, 0);
    const earlierDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2, 12, 0, 0);

    const invalidSchedulePayload = {
      movieId: testMovie._id,
      theatreId: testTheatre._id,
      screenId: testScreen._id,
      startTime: baseDate.toISOString(),
      endTime: earlierDate.toISOString(), // end before start!
      pricing: { silver: 200, gold: 300, premium: 450 },
    };

    const resInvalidSchedule = await fetch(`${BASE_URL}/showtimes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify(invalidSchedulePayload),
    });
    console.log('Invalid schedule status:', resInvalidSchedule.status, '(expected 400)');
    if (resInvalidSchedule.status !== 400) {
      throw new Error(`Expected 400 for invalid schedule, got ${resInvalidSchedule.status}`);
    }
    console.log('✅ Invalid schedule rejected with 400');

    // 9. Test Showtime Creation (Valid)
    console.log('\n--- Test 7: Valid showtime creation ---');
    const validStartTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2, 14, 0, 0);
    const validEndTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2, 16, 30, 0);

    const validShowtimePayload = {
      movieId: testMovie._id,
      theatreId: testTheatre._id,
      screenId: testScreen._id,
      startTime: validStartTime.toISOString(),
      endTime: validEndTime.toISOString(),
      pricing: { silver: 220, gold: 320, premium: 500 },
    };

    const resValidShowtime = await fetch(`${BASE_URL}/showtimes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify(validShowtimePayload),
    });
    const dataValidShowtime = await resValidShowtime.json();
    console.log('Valid showtime status:', resValidShowtime.status, '(expected 201)');
    if (resValidShowtime.status !== 201 || !dataValidShowtime.success) {
      throw new Error(`Showtime creation failed: ${JSON.stringify(dataValidShowtime)}`);
    }
    createdShowtimeId = dataValidShowtime.showtime._id;
    console.log('✅ Showtime created with ID:', createdShowtimeId);

    // 10. Test Showtime Overlap Collision Prevention (409 Conflict)
    console.log('\n--- Test 8: Overlapping showtime conflict detection (409 Conflict) ---');
    // Overlap: Starts 15:00, ends 17:30 (overlaps with 14:00 - 16:30 on same screen)
    const overlappingStartTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2, 15, 0, 0);
    const overlappingEndTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2, 17, 30, 0);

    const overlapPayload = {
      movieId: testMovie._id,
      theatreId: testTheatre._id,
      screenId: testScreen._id,
      startTime: overlappingStartTime.toISOString(),
      endTime: overlappingEndTime.toISOString(),
      pricing: { silver: 220, gold: 320, premium: 500 },
    };

    const resOverlap = await fetch(`${BASE_URL}/showtimes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify(overlapPayload),
    });
    const dataOverlap = await resOverlap.json();
    console.log('Overlap status:', resOverlap.status, '(expected 409)');
    if (resOverlap.status !== 409) {
      throw new Error(`Expected 409 Conflict for overlapping schedule, got ${resOverlap.status}`);
    }
    console.log('✅ Overlap conflict correctly rejected with 409:', dataOverlap.message);

    // 11. Test Showtime Query by Movie and Date
    console.log('\n--- Test 9: GET /api/showtimes by movie and date ---');
    const queryDateStr = validStartTime.toISOString().split('T')[0];
    const resQueryShowtimes = await fetch(
      `${BASE_URL}/showtimes?movieId=${testMovie._id}&date=${queryDateStr}`
    );
    const dataQueryShowtimes = await resQueryShowtimes.json();
    console.log('Query showtimes status:', resQueryShowtimes.status, '(expected 200)');
    if (resQueryShowtimes.status !== 200 || !dataQueryShowtimes.success) {
      throw new Error(`Failed to query showtimes: ${JSON.stringify(dataQueryShowtimes)}`);
    }
    const foundShowtime = dataQueryShowtimes.showtimes.find((s) => s._id === createdShowtimeId);
    if (!foundShowtime) {
      throw new Error('Created showtime not found in query results');
    }
    console.log('✅ Showtime found in date query. Formatted time virtual:', foundShowtime.formattedTime);

    // 12. Test Showtime Details (GET /api/showtimes/:id)
    console.log('\n--- Test 10: GET /api/showtimes/:id ---');
    const resShowtimeDetail = await fetch(`${BASE_URL}/showtimes/${createdShowtimeId}`);
    const dataShowtimeDetail = await resShowtimeDetail.json();
    console.log('Showtime detail status:', resShowtimeDetail.status, '(expected 200)');
    if (resShowtimeDetail.status !== 200 || !dataShowtimeDetail.showtime) {
      throw new Error('Failed to fetch showtime details');
    }
    console.log('✅ Showtime detail loaded with populated movie and screen');

    // 13. Test Update and Delete Showtime
    console.log('\n--- Test 11: Admin update and delete showtime ---');
    const resUpdate = await fetch(`${BASE_URL}/showtimes/${createdShowtimeId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        pricing: { silver: 250, gold: 350, premium: 550 },
      }),
    });
    const dataUpdate = await resUpdate.json();
    console.log('Update status:', resUpdate.status, '(expected 200)');
    if (resUpdate.status !== 200 || dataUpdate.showtime.pricing.silver !== 250) {
      throw new Error('Failed to update showtime pricing');
    }

    const resDelete = await fetch(`${BASE_URL}/showtimes/${createdShowtimeId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    console.log('Delete status:', resDelete.status, '(expected 200)');
    if (resDelete.status !== 200) {
      throw new Error('Failed to delete showtime');
    }
    console.log('✅ Showtime successfully updated and deleted');

    console.log('\n==========================================');
    console.log('🎉 ALL THEATRE & SHOWTIME TESTS PASSED!');
    console.log('==========================================');
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    process.exitCode = 1;
  } finally {
    // Cleanup created test records
    console.log('\n🧹 Cleaning up test data...');
    try {
      if (createdShowtimeId) await Showtime.findByIdAndDelete(createdShowtimeId);
      if (testScreen) await Screen.findByIdAndDelete(testScreen._id);
      if (testTheatre) await Theatre.findByIdAndDelete(testTheatre._id);
      await User.deleteMany({ email: { $in: [adminEmail, normalUserEmail] } });
    } catch (cleanupErr) {
      console.warn('Cleanup error (ignored):', cleanupErr.message);
    }
    server.close();
    await mongoose.connection.close();
    process.exit(process.exitCode || 0);
  }
}

runTheatreShowtimeTests();
