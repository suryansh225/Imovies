import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import User from '../src/models/User.js';
import Movie from '../src/models/Movie.js';

async function runMovieTests() {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/imovies';
  const JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_12345';
  process.env.JWT_SECRET = JWT_SECRET;
  process.env.MONGODB_URI = MONGODB_URI;
  process.env.NODE_ENV = 'test';

  console.log('🔄 Starting Movie API test suite...');

  // Connect to MongoDB
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  // Ensure index on movie model
  await Movie.init();

  // Dynamically import server app
  const { default: app } = await import('../src/server.js');

  const PORT = 5006;
  const server = app.listen(PORT);
  const BASE_URL = `http://127.0.0.1:${PORT}/api`;

  const adminEmail = `admin_test_${Date.now()}@example.com`;
  const normalUserEmail = `user_test_${Date.now()}@example.com`;
  let adminToken = null;
  let userToken = null;
  let createdMovieId = null;

  try {
    // 1. Create a normal user and an admin user
    await User.deleteMany({ email: { $in: [adminEmail, normalUserEmail] } });

    const normalUser = await User.create({
      name: 'Normal User',
      email: normalUserEmail,
      password: 'UserPass123!',
      role: 'user',
    });
    userToken = jwt.sign({ id: normalUser._id }, JWT_SECRET, { expiresIn: '1h' });

    const adminUser = await User.create({
      name: 'Admin User',
      email: adminEmail,
      password: 'AdminPass123!',
      role: 'admin',
    });
    adminToken = jwt.sign({ id: adminUser._id }, JWT_SECRET, { expiresIn: '1h' });
    console.log('✅ Normal and Admin test users created');

    // 2. Test GET /api/movies (listing)
    console.log('\n--- Test 1: GET /api/movies (listing) ---');
    const res1 = await fetch(`${BASE_URL}/movies`);
    const data1 = await res1.json();
    console.log('Status:', res1.status, '(expected 200)');
    console.log('Movie count returned:', data1.count, 'Total in DB:', data1.total);
    if (res1.status !== 200 || !data1.success || !Array.isArray(data1.movies)) {
      throw new Error('Test 1 failed: Listing movies failed');
    }
    console.log('✅ Test 1 Passed: Movie listing works');

    // Pick an existing movie ID for details testing
    const sampleMovie = data1.movies[0];
    const sampleId = sampleMovie ? (sampleMovie._id || sampleMovie.id) : null;

    // 3. Test GET /api/movies/:id (valid details)
    if (sampleId) {
      console.log(`\n--- Test 2: GET /api/movies/${sampleId} (details) ---`);
      const res2 = await fetch(`${BASE_URL}/movies/${sampleId}`);
      const data2 = await res2.json();
      console.log('Status:', res2.status, '(expected 200)');
      console.log('Movie title:', data2.movie?.title);
      if (res2.status !== 200 || !data2.success || !data2.movie) {
        throw new Error('Test 2 failed: Details lookup failed');
      }
      console.log('✅ Test 2 Passed: Single movie details lookup works');
    }

    // 4. Test GET /api/movies/:id with invalid MongoDB ID format
    console.log('\n--- Test 3: GET /api/movies/invalid-id-12345 (invalid ID format) ---');
    const res3 = await fetch(`${BASE_URL}/movies/invalid-id-12345`);
    const data3 = await res3.json();
    console.log('Status:', res3.status, '(expected 400)');
    console.log('Response:', data3.message);
    if (res3.status !== 400 || data3.success !== false) {
      throw new Error('Test 3 failed: Invalid ID was not rejected with 400');
    }
    console.log('✅ Test 3 Passed: Invalid ID format rejected with 400');

    // 5. Test GET /api/movies/:id with non-existent valid ObjectId
    console.log('\n--- Test 4: GET /api/movies/60d5ec49e25d2b1f8c8b4567 (missing movie) ---');
    const res4 = await fetch(`${BASE_URL}/movies/60d5ec49e25d2b1f8c8b4567`);
    const data4 = await res4.json();
    console.log('Status:', res4.status, '(expected 404)');
    console.log('Response:', data4.message);
    if (res4.status !== 404 || data4.success !== false) {
      throw new Error('Test 4 failed: Non-existent movie not returned 404');
    }
    console.log('✅ Test 4 Passed: Missing movie returns 404');

    // 6. Test search filter: GET /api/movies?search=Echoes
    console.log('\n--- Test 5: GET /api/movies?search=Echoes ---');
    const res5 = await fetch(`${BASE_URL}/movies?search=Echoes`);
    const data5 = await res5.json();
    console.log('Status:', res5.status, '(expected 200)');
    console.log('Found:', data5.movies.map((m) => m.title));
    if (res5.status !== 200 || !data5.movies.some((m) => m.title.includes('Echoes'))) {
      throw new Error('Test 5 failed: Search filter failed');
    }
    console.log('✅ Test 5 Passed: Search query filter works');

    // 7. Test genre and status filter: GET /api/movies?genre=Action&status=now_showing
    console.log('\n--- Test 6: GET /api/movies?genre=Action&status=now_showing ---');
    const res6 = await fetch(`${BASE_URL}/movies?genre=Action&status=now_showing`);
    const data6 = await res6.json();
    console.log('Status:', res6.status, '(expected 200)');
    console.log('Count:', data6.count);
    if (res6.status !== 200 || !data6.success) {
      throw new Error('Test 6 failed: Genre/status filter failed');
    }
    console.log('✅ Test 6 Passed: Genre and status filters work');

    // 8. Test pagination: GET /api/movies?page=1&limit=3
    console.log('\n--- Test 7: GET /api/movies?page=1&limit=3 (pagination) ---');
    const res7 = await fetch(`${BASE_URL}/movies?page=1&limit=3`);
    const data7 = await res7.json();
    console.log('Status:', res7.status, 'Page:', data7.page, 'Limit count:', data7.count, 'TotalPages:', data7.totalPages);
    if (res7.status !== 200 || data7.count !== 3 || data7.page !== 1) {
      throw new Error('Test 7 failed: Pagination failed');
    }
    console.log('✅ Test 7 Passed: Pagination works');

    // 9. Unauthorized attempt to create movie (No token)
    console.log('\n--- Test 8: POST /api/movies without token (unauthorized) ---');
    const res8 = await fetch(`${BASE_URL}/movies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Hacker Movie' }),
    });
    const data8 = await res8.json();
    console.log('Status:', res8.status, '(expected 401)');
    if (res8.status !== 401) throw new Error('Test 8 failed: Unauthenticated user allowed to create movie');
    console.log('✅ Test 8 Passed: Unauthenticated create rejected with 401');

    // 10. Forbidden attempt to create movie (Normal user token)
    console.log('\n--- Test 9: POST /api/movies with normal user token (forbidden) ---');
    const res9 = await fetch(`${BASE_URL}/movies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({ title: 'Unauthorized Movie' }),
    });
    const data9 = await res9.json();
    console.log('Status:', res9.status, '(expected 403)');
    console.log('Message:', data9.message);
    if (res9.status !== 403) throw new Error('Test 9 failed: Non-admin user allowed to create movie');
    console.log('✅ Test 9 Passed: Non-admin create rejected with 403');

    // 11. Admin creates a movie successfully
    console.log('\n--- Test 10: POST /api/movies with admin token (success) ---');
    const newMovieData = {
      title: `Admin Test Movie ${Date.now()}`,
      description: 'An exclusive film created by admin tests.',
      poster: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400&h=600&fit=crop',
      backdrop: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1200&h=600&fit=crop',
      genre: ['Action', 'Thriller'],
      language: 'English',
      duration: '2h 15m',
      releaseDate: '2026-12-01',
      certificate: 'UA',
      director: 'Christopher Nolan',
      cast: ['Cillian Murphy', 'Tom Hardy'],
      price: 350,
      status: 'now_showing',
    };
    const res10 = await fetch(`${BASE_URL}/movies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify(newMovieData),
    });
    const data10 = await res10.json();
    console.log('Status:', res10.status, '(expected 201)');
    console.log('Created movie:', data10.movie?.title);
    if (res10.status !== 201 || !data10.movie?._id) {
      throw new Error('Test 10 failed: Admin create movie failed');
    }
    createdMovieId = data10.movie._id;
    console.log('✅ Test 10 Passed: Admin created movie successfully');

    // 12. Admin updates movie: PATCH /api/movies/:id
    console.log(`\n--- Test 11: PATCH /api/movies/${createdMovieId} with admin token ---`);
    const res11 = await fetch(`${BASE_URL}/movies/${createdMovieId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ price: 380, trending: true }),
    });
    const data11 = await res11.json();
    console.log('Status:', res11.status, '(expected 200)');
    console.log('Updated price:', data11.movie?.price, 'Trending:', data11.movie?.trending);
    if (res11.status !== 200 || data11.movie?.price !== 380 || data11.movie?.trending !== true) {
      throw new Error('Test 11 failed: Admin update movie failed');
    }
    console.log('✅ Test 11 Passed: Admin updated movie successfully');

    // 13. Admin deletes movie: DELETE /api/movies/:id
    console.log(`\n--- Test 12: DELETE /api/movies/${createdMovieId} with admin token ---`);
    const res12 = await fetch(`${BASE_URL}/movies/${createdMovieId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    const data12 = await res12.json();
    console.log('Status:', res12.status, '(expected 200)');
    if (res12.status !== 200 || !data12.success) {
      throw new Error('Test 12 failed: Admin delete movie failed');
    }
    const checkDeleted = await Movie.findById(createdMovieId);
    if (checkDeleted) throw new Error('Test 12 failed: Movie still exists in database');
    console.log('✅ Test 12 Passed: Admin deleted movie successfully');

    // Clean up test users
    await User.deleteMany({ email: { $in: [adminEmail, normalUserEmail] } });
    console.log('\n🎉 ALL 12 MOVIE API TESTS PASSED SUCCESSFULLY!');
  } finally {
    server.close();
    await mongoose.connection.close();
  }
}

runMovieTests().catch((err) => {
  console.error('\n❌ Movie test execution failed:', err);
  process.exit(1);
});
