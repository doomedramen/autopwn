const axios = require('axios');

const API_URL = 'http://localhost:3001';
const WEB_URL = 'http://localhost:3000';

// Create a session cookie jar
const jar = axios.create({
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

async function testAuthFlow() {
  console.log('🔍 Testing authentication flow...');

  try {
    // Step 1: Check initial session (should be null)
    console.log('\n1. Checking initial session...');
    const initialSession = await axios.get(`${API_URL}/api/debug/session`, {
      withCredentials: true
    });
    console.log('Initial session:', JSON.stringify(initialSession.data, null, 2));

    // Step 2: Authenticate with the test superuser
    console.log('\n2. Authenticating with superuser...');
    const authResponse = await axios.post(`${API_URL}/api/auth/sign-in/email`, {
      email: 'admin@autopwn.local',
      password: 'admin123'
    }, {
      withCredentials: true
    });
    console.log('Auth response status:', authResponse.status);

    // Step 3: Check session after authentication
    console.log('\n3. Checking session after authentication...');
    const authSession = await axios.get(`${API_URL}/api/debug/session`, {
      withCredentials: true
    });
    console.log('Authenticated session:', JSON.stringify(authSession.data, null, 2));

    // Step 4: Try to access admin endpoint
    console.log('\n4. Testing admin access...');
    try {
      const usersResponse = await axios.get(`${API_URL}/api/users`, {
        withCredentials: true
      });
      console.log('✅ Admin access successful! Status:', usersResponse.status);
      console.log('Users data:', JSON.stringify(usersResponse.data, null, 2));
    } catch (error) {
      console.log('❌ Admin access failed:', error.response?.data || error.message);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

testAuthFlow();