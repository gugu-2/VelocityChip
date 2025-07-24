const http = require('http');
const WebSocket = require('ws');

// Test configuration
const BASE_URL = 'http://localhost:3001';
const WS_URL = 'ws://localhost:3001';

// Test data
const testDesign = {
  name: 'Test Circuit',
  components: [
    {
      id: 1,
      type: 'transistor',
      name: 'NMOS_1',
      properties: { width: '10', length: '0.5', threshold: '0.7' }
    },
    {
      id: 2,
      type: 'resistor',
      name: 'R1',
      properties: { resistance: '1000', power: '0.25' }
    },
    {
      id: 3,
      type: 'capacitor',
      name: 'C1',
      properties: { capacitance: '1e-12', voltage: '5' }
    }
  ],
  connections: [
    { from: 1, to: 2, signal: 'VDD' },
    { from: 2, to: 3, signal: 'OUT' }
  ]
};

// Helper function to make HTTP requests
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const response = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, data: response });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// Test functions
async function testHealthCheck() {
  console.log('🔍 Testing health check...');
  try {
    const response = await makeRequest('GET', '/api/health');
    if (response.status === 200) {
      console.log('✅ Health check passed');
      console.log('   Server status:', response.data.status);
      console.log('   Uptime:', response.data.uptime.toFixed(2), 'seconds');
      return true;
    } else {
      console.log('❌ Health check failed:', response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ Health check error:', error.message);
    return false;
  }
}

async function testComponentLibrary() {
  console.log('🔍 Testing component library...');
  try {
    const response = await makeRequest('GET', '/api/components');
    if (response.status === 200) {
      const components = Object.keys(response.data);
      console.log('✅ Component library loaded');
      console.log('   Available components:', components.join(', '));
      return true;
    } else {
      console.log('❌ Component library failed:', response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ Component library error:', error.message);
    return false;
  }
}

async function testDesignCRUD() {
  console.log('🔍 Testing design CRUD operations...');
  let designId;
  
  try {
    // Create design
    const createResponse = await makeRequest('POST', '/api/designs', testDesign);
    if (createResponse.status !== 201) {
      console.log('❌ Design creation failed:', createResponse.status);
      return false;
    }
    designId = createResponse.data.id;
    console.log('✅ Design created with ID:', designId);

    // Get all designs
    const listResponse = await makeRequest('GET', '/api/designs');
    if (listResponse.status !== 200 || listResponse.data.length === 0) {
      console.log('❌ Design listing failed');
      return false;
    }
    console.log('✅ Design listing works');

    // Get specific design
    const getResponse = await makeRequest('GET', `/api/designs/${designId}`);
    if (getResponse.status !== 200) {
      console.log('❌ Design retrieval failed');
      return false;
    }
    console.log('✅ Design retrieval works');

    // Update design
    const updateData = { name: 'Updated Test Circuit' };
    const updateResponse = await makeRequest('PUT', `/api/designs/${designId}`, updateData);
    if (updateResponse.status !== 200) {
      console.log('❌ Design update failed');
      return false;
    }
    console.log('✅ Design update works');

    // Test simulation
    const simResponse = await makeRequest('POST', `/api/designs/${designId}/simulate`, { steps: 10 });
    if (simResponse.status !== 200) {
      console.log('❌ Simulation failed');
      return false;
    }
    console.log('✅ Simulation works');
    console.log('   Simulation results:', simResponse.data.simulationResults.length, 'steps');

    // Test export
    const exportResponse = await makeRequest('POST', `/api/designs/${designId}/export`, { format: 'json' });
    if (exportResponse.status !== 200) {
      console.log('❌ Export failed');
      return false;
    }
    console.log('✅ Export works');

    // Delete design
    const deleteResponse = await makeRequest('DELETE', `/api/designs/${designId}`);
    if (deleteResponse.status !== 204) {
      console.log('❌ Design deletion failed');
      return false;
    }
    console.log('✅ Design deletion works');

    return true;
  } catch (error) {
    console.log('❌ Design CRUD error:', error.message);
    return false;
  }
}

async function testWebSocket() {
  console.log('🔍 Testing WebSocket functionality...');
  
  return new Promise(async (resolve) => {
    try {
      // First create a design for testing
      const createResponse = await makeRequest('POST', '/api/designs', testDesign);
      if (createResponse.status !== 201) {
        console.log('❌ Failed to create design for WebSocket test');
        resolve(false);
        return;
      }
      const designId = createResponse.data.id;

      const ws = new WebSocket(WS_URL);
      let testsPassed = 0;
      const totalTests = 2;

      ws.on('open', () => {
        console.log('✅ WebSocket connection established');
        
        // Test simulation start
        ws.send(JSON.stringify({
          type: 'start_simulation',
          designId: designId,
          config: { updateRate: 500, duration: 2000 }
        }));
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          
          if (message.type === 'simulation_started') {
            console.log('✅ Simulation started via WebSocket');
            testsPassed++;
          }
          
          if (message.type === 'simulation_data') {
            console.log('✅ Receiving simulation data via WebSocket');
            console.log('   Sample data keys:', Object.keys(message.data));
            testsPassed++;
            
            // Stop simulation after receiving data
            ws.send(JSON.stringify({ type: 'stop_simulation' }));
          }
          
          if (message.type === 'simulation_stopped') {
            console.log('✅ Simulation stopped via WebSocket');
            ws.close();
          }
        } catch (error) {
          console.log('❌ WebSocket message parsing error:', error.message);
        }
      });

      ws.on('close', async () => {
        // Clean up test design
        await makeRequest('DELETE', `/api/designs/${designId}`);
        
        if (testsPassed >= totalTests) {
          console.log('✅ WebSocket tests passed');
          resolve(true);
        } else {
          console.log('❌ WebSocket tests failed');
          resolve(false);
        }
      });

      ws.on('error', (error) => {
        console.log('❌ WebSocket error:', error.message);
        resolve(false);
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
        console.log('⏰ WebSocket test timeout');
        resolve(false);
      }, 10000);

    } catch (error) {
      console.log('❌ WebSocket test setup error:', error.message);
      resolve(false);
    }
  });
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting VelocityChip Backend Tests\n');
  
  const tests = [
    { name: 'Health Check', fn: testHealthCheck },
    { name: 'Component Library', fn: testComponentLibrary },
    { name: 'Design CRUD', fn: testDesignCRUD },
    { name: 'WebSocket', fn: testWebSocket }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    console.log(`\n--- ${test.name} ---`);
    try {
      const result = await test.fn();
      if (result) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      console.log(`❌ ${test.name} threw an error:`, error.message);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 Test Results:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  
  if (failed === 0) {
    console.log('🎉 All tests passed! VelocityChip backend is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Please check the server and try again.');
  }
}

// Check if server is running before starting tests
async function checkServer() {
  try {
    const response = await makeRequest('GET', '/api/health');
    if (response.status === 200) {
      return true;
    }
  } catch (error) {
    return false;
  }
  return false;
}

// Start tests
async function main() {
  console.log('Checking if VelocityChip server is running...');
  
  const serverRunning = await checkServer();
  if (!serverRunning) {
    console.log('❌ Server is not running. Please start the server first with: npm start');
    console.log('   Then run this test with: node test-backend.js');
    process.exit(1);
  }
  
  console.log('✅ Server is running. Starting tests...\n');
  await runTests();
}

main().catch(console.error);