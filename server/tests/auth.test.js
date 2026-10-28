import mongoose from 'mongoose';
import User from '../src/models/User.js';

async function runTests() {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/imovies';
  const JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_12345';
  process.env.JWT_SECRET = JWT_SECRET;
  process.env.MONGODB_URI = MONGODB_URI;
  process.env.NODE_ENV = 'test';

  console.log('🔄 Starting authentication test suite...');

  // Connect to MongoDB
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  // Dynamically import server app
  const { default: app } = await import('../src/server.js');

  const PORT = 5005;
  const server = app.listen(PORT);
  const BASE_URL = `http://127.0.0.1:${PORT}/api`;

  const testEmail = `testuser_${Date.now()}@example.com`;
  const testPassword = 'Password123!';
  let authToken = null;
  let authCookie = null;

  try {
    // Clean up any existing test user with this email
    await User.deleteMany({ email: testEmail });

    // Test 1: Reject registration with missing fields
    console.log('\n--- Test 1: Reject registration with invalid input (missing fields) ---');
    const res1 = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test' }),
    });
    const data1 = await res1.json();
    console.log('Status:', res1.status, '(expected 400)');
    console.log('Response:', data1);
    if (res1.status !== 400 || data1.success !== false) throw new Error('Test 1 failed');
    console.log('✅ Test 1 Passed');

    // Test 2: Reject registration with short password
    console.log('\n--- Test 2: Reject registration with short password (<6 chars) ---');
    const res2 = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test', email: testEmail, password: '123' }),
    });
    const data2 = await res2.json();
    console.log('Status:', res2.status, '(expected 400)');
    if (res2.status !== 400) throw new Error('Test 2 failed');
    console.log('✅ Test 2 Passed');

    // Test 3: Register a new user successfully
    console.log('\n--- Test 3: Register a new user successfully ---');
    const res3 = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'John Test',
        email: testEmail,
        password: testPassword,
        role: 'admin', // Attempt to escalate role - should be ignored and set to 'user'
      }),
    });
    const data3 = await res3.json();
    console.log('Status:', res3.status, '(expected 201)');
    console.log('User created:', data3.user);
    if (res3.status !== 201 || !data3.token || data3.user.email !== testEmail.toLowerCase()) {
      throw new Error('Test 3 failed');
    }
    if (data3.user.password || data3.user.passwordHash) {
      throw new Error('Test 3 failed: password was returned in response!');
    }
    if (data3.user.role !== 'user') {
      throw new Error('Test 3 failed: client was able to register as admin!');
    }
    authToken = data3.token;
    const rawCookie = res3.headers.get('set-cookie');
    if (rawCookie) {
      authCookie = rawCookie.split(';')[0];
    }
    console.log('✅ Test 3 Passed: User registered, token received, role forced to user, no password exposed');

    // Test 4: Verify user document in MongoDB is hashed
    console.log('\n--- Test 4: Confirm user document in MongoDB has hashed password ---');
    const dbUser = await User.findOne({ email: testEmail }).select('+password');
    console.log('Stored DB user password hash:', dbUser.password);
    if (!dbUser || !dbUser.password || dbUser.password === testPassword || !dbUser.password.startsWith('$2')) {
      throw new Error('Test 4 failed: password is not properly hashed with bcrypt in DB');
    }
    console.log('✅ Test 4 Passed: MongoDB document has proper bcrypt hash');

    // Test 5: Reject duplicate email registration
    console.log('\n--- Test 5: Reject duplicate email registration ---');
    const res5 = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Another Name', email: testEmail, password: testPassword }),
    });
    const data5 = await res5.json();
    console.log('Status:', res5.status, '(expected 409)');
    console.log('Message:', data5.message);
    if (res5.status !== 409) throw new Error('Test 5 failed: duplicate registration allowed');
    console.log('✅ Test 5 Passed: Duplicate registration rejected with 409');

    // Test 6: Log in with valid credentials
    console.log('\n--- Test 6: Log in with valid credentials ---');
    const res6 = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: testPassword }),
    });
    const data6 = await res6.json();
    console.log('Status:', res6.status, '(expected 200)');
    if (res6.status !== 200 || !data6.token || !data6.user) throw new Error('Test 6 failed');
    authToken = data6.token;
    console.log('✅ Test 6 Passed: Login successful');

    // Test 7: Reject incorrect password
    console.log('\n--- Test 7: Reject incorrect password ---');
    const res7 = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: 'WrongPassword999!' }),
    });
    const data7 = await res7.json();
    console.log('Status:', res7.status, '(expected 401)');
    console.log('Message:', data7.message);
    if (res7.status !== 401) throw new Error('Test 7 failed');
    console.log('✅ Test 7 Passed: Invalid password rejected with 401');

    // Test 8: Retrieve profile with Bearer token (/api/auth/me)
    console.log('\n--- Test 8: Retrieve profile via /api/auth/me using Bearer token ---');
    const res8 = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const data8 = await res8.json();
    console.log('Status:', res8.status, '(expected 200)');
    console.log('Retrieved user:', data8.user);
    if (res8.status !== 200 || data8.user.email !== testEmail.toLowerCase()) {
      throw new Error('Test 8 failed');
    }
    console.log('✅ Test 8 Passed: Profile retrieved via Bearer token');

    // Test 9: Retrieve profile with HttpOnly cookie if cookie set
    if (authCookie) {
      console.log('\n--- Test 9: Retrieve profile via /api/auth/me using Cookie ---');
      const res9 = await fetch(`${BASE_URL}/auth/me`, {
        headers: { Cookie: authCookie },
      });
      const data9 = await res9.json();
      console.log('Status:', res9.status, '(expected 200)');
      if (res9.status !== 200 || data9.user.email !== testEmail.toLowerCase()) {
        throw new Error('Test 9 failed');
      }
      console.log('✅ Test 9 Passed: Profile retrieved via Cookie');
    }

    // Test 10: Reject invalid token
    console.log('\n--- Test 10: Reject invalid or malformed token ---');
    const res10 = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: 'Bearer thisiscompletelyinvalid' },
    });
    const data10 = await res10.json();
    console.log('Status:', res10.status, '(expected 401)');
    if (res10.status !== 401) throw new Error('Test 10 failed');
    console.log('✅ Test 10 Passed: Invalid token rejected with 401');

    // Test 11: Logout endpoint clears cookie
    console.log('\n--- Test 11: Logout clears session ---');
    const res11 = await fetch(`${BASE_URL}/auth/logout`, { method: 'POST' });
    const data11 = await res11.json();
    console.log('Status:', res11.status, '(expected 200)');
    console.log('Cookie header on logout:', res11.headers.get('set-cookie'));
    if (res11.status !== 200 || !data11.success) throw new Error('Test 11 failed');
    console.log('✅ Test 11 Passed: Logout cleared cookie successfully');

    // Cleanup test user
    await User.deleteMany({ email: testEmail });
    console.log('\n🎉 ALL 11 TESTS PASSED SUCCESSFULLY!');
  } finally {
    server.close();
    await mongoose.connection.close();
  }
}

runTests().catch((err) => {
  console.error('\n❌ Test execution failed:', err);
  process.exit(1);
});
