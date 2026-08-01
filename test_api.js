const http = require('http');

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

// Helper to send HTTP requests
function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const dataStr = body ? JSON.stringify(body) : '';
    
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };
    
    if (body) {
      options.headers['Content-Length'] = Buffer.byteLength(dataStr);
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, rawBody: data });
        }
      });
    });

    req.on('error', (err) => reject(err));
    if (body) {
      req.write(dataStr);
    }
    req.end();
  });
}

// Start testing suite
async function runTests() {
  console.log('--- STARTING BACKEND API ENDPOINT VERIFICATION ---');
  
  try {
    // 1. Verify static load or GET settings
    const settingsRes = await request('GET', '/api/settings');
    console.log(`[TEST] GET /api/settings: Status ${settingsRes.status} (Expected: 200)`);
    if (settingsRes.status === 200 && settingsRes.body.eventTitle) {
      console.log('   -> SUCCESS: Settings retrieved correctly.');
    } else {
      console.error('   -> FAILURE: Invalid settings response.');
    }

    // 2. Test Admin Login with valid credentials
    const loginValidRes = await request('POST', '/api/admin/login', {
      email: 'checkin@a19.com',
      password: '12345'
    });
    console.log(`[TEST] Admin Login (Valid): Status ${loginValidRes.status} (Expected: 200)`);
    if (loginValidRes.status === 200 && loginValidRes.body.success) {
      console.log('   -> SUCCESS: Token received.');
    } else {
      console.error('   -> FAILURE: Login rejected valid credentials.');
    }

    // 3. Test Admin Login with invalid credentials
    const loginInvalidRes = await request('POST', '/api/admin/login', {
      email: 'wrong@a19.com',
      password: 'wrong'
    });
    console.log(`[TEST] Admin Login (Invalid): Status ${loginInvalidRes.status} (Expected: 401)`);
    if (loginInvalidRes.status === 401 && !loginInvalidRes.body.success) {
      console.log('   -> SUCCESS: Properly unauthorized.');
    } else {
      console.error('   -> FAILURE: Allowed login with wrong credentials.');
    }

    // 4. Test Add Creator
    const newCreator = {
      instagram: 'jigris_tester',
      tickets: 4
    };
    const addRes = await request('POST', '/api/creators', newCreator);
    console.log(`[TEST] POST /api/creators: Status ${addRes.status} (Expected: 200)`);
    let testCreatorId = null;
    if (addRes.status === 200 && addRes.body.creator && addRes.body.creator.id) {
      testCreatorId = addRes.body.creator.id;
      console.log(`   -> SUCCESS: Creator added with ID: ${testCreatorId}`);
    } else {
      console.error('   -> FAILURE: Failed to create influencer.');
    }

    if (testCreatorId) {
      // 5. Test Get Creator by ID
      const getRes = await request('GET', `/api/creators/${testCreatorId}`);
      console.log(`[TEST] GET /api/creators/:id: Status ${getRes.status} (Expected: 200)`);
      if (getRes.status === 200 && getRes.body.instagram === 'jigris_tester') {
        console.log('   -> SUCCESS: Retreived creator matches target.');
      } else {
        console.error('   -> FAILURE: Creator mismatch or fetch error.');
      }

      // 6. Test Perform Check-in
      const checkinRes = await request('POST', `/api/creators/${testCreatorId}/checkin`);
      console.log(`[TEST] POST /api/creators/:id/checkin: Status ${checkinRes.status} (Expected: 200)`);
      if (checkinRes.status === 200 && checkinRes.body.creator.status === 'Checked In') {
        console.log('   -> SUCCESS: Creator checked-in successfully.');
      } else {
        console.error('   -> FAILURE: Checkin status not updated.');
      }

      // 7. Test Duplicate Check-in
      const checkinDupRes = await request('POST', `/api/creators/${testCreatorId}/checkin`);
      console.log(`[TEST] POST /api/creators/:id/checkin (Duplicate): Status ${checkinDupRes.status} (Expected: 400)`);
      if (checkinDupRes.status === 400 && !checkinDupRes.body.success) {
        console.log('   -> SUCCESS: Blocked duplicate scan successfully.');
      } else {
        console.error('   -> FAILURE: Allowed duplicate checkin.');
      }

      // 8. Test Clean Up Delete
      const deleteRes = await request('DELETE', `/api/creators/${testCreatorId}`);
      console.log(`[TEST] DELETE /api/creators/:id: Status ${deleteRes.status} (Expected: 200)`);
      if (deleteRes.status === 200 && deleteRes.body.success) {
        console.log('   -> SUCCESS: Creator deleted.');
      } else {
        console.error('   -> FAILURE: Failed to delete test influencer.');
      }
    }

    console.log('--- ALL BACKEND TEST DIAGNOSTICS COMPLETED ---');
    process.exit(0);

  } catch (error) {
    console.error('Test execution error:', error);
    process.exit(1);
  }
}

// Start testing (expects server to be running or we start it)
runTests();
