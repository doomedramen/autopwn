#!/usr/bin/env node

// Simple test to verify password storage functionality
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function testPasswordStorage() {
  console.log('🧪 Testing password storage functionality...\n');

  try {
    // 1. Start the app (if not already running)
    console.log('1. Ensuring app is running...');
    try {
      const response = await fetch('http://localhost:3000/api/health');
      console.log('✓ App is already running');
    } catch (error) {
      console.log('Starting app...');
      const appProcess = require('child_process').spawn('npm', ['run', 'dev'], {
        stdio: 'inherit',
        detached: true
      });
      appProcess.unref();

      // Wait for app to start
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // 2. Upload dictionary
    console.log('2. Uploading dictionary...');
    const dictPath = 'src/tests/fixtures/test-passwords.txt';
    const dictFormData = new FormData();
    dictFormData.append('file', new Blob([fs.readFileSync(dictPath)], { type: 'text/plain' }), 'test-passwords.txt');

    const dictResponse = await fetch('http://localhost:3000/api/upload/dictionary', {
      method: 'POST',
      body: dictFormData
    });

    if (!dictResponse.ok) {
      throw new Error(`Dictionary upload failed: ${dictResponse.statusText}`);
    }

    const dictResult = await dictResponse.json();
    const dictId = dictResult.data.id;
    console.log(`✓ Dictionary uploaded: ${dictId}`);

    // 3. Upload PCAP
    console.log('3. Uploading PCAP...');
    const pcapPath = 'src/tests/fixtures/wpa2-ikeriri-5g.pcap';
    const pcapFormData = new FormData();
    pcapFormData.append('file', new Blob([fs.readFileSync(pcapPath)], { type: 'application/octet-stream' }), 'wpa2-ikeriri-5g.pcap');

    const pcapResponse = await fetch('http://localhost:3000/api/upload/pcap', {
      method: 'POST',
      body: pcapFormData
    });

    if (!pcapResponse.ok) {
      throw new Error(`PCAP upload failed: ${pcapResponse.statusText}`);
    }

    const pcapResult = await pcapResponse.json();
    const pcapId = pcapResult.data.id;
    console.log(`✓ PCAP uploaded: ${pcapId}`);

    // 4. Get networks from PCAP
    console.log('4. Getting networks...');
    const networksResponse = await fetch(`http://localhost:3000/api/pcap/${pcapId}/networks`);
    const networksData = await networksResponse.json();
    const networkBssid = networksData.data[0].bssid;
    console.log(`✓ Found network: ${networkBssid}`);

    // 5. Create job
    console.log('5. Creating cracking job...');
    const jobResponse = await fetch('http://localhost:3000/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Password Storage Test',
        networks: [networkBssid],
        dictionaries: [dictId],
        options: {
          attackMode: 0,
          hashType: 22000,
          workloadProfile: 3
        }
      })
    });

    if (!jobResponse.ok) {
      throw new Error(`Job creation failed: ${jobResponse.statusText}`);
    }

    const jobResult = await jobResponse.json();
    const jobId = jobResult.data.id;
    console.log(`✓ Job created: ${jobId}`);

    // 6. Wait for job to complete
    console.log('6. Waiting for job to complete...');
    let jobStatus = 'processing';
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max

    while (jobStatus === 'processing' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000));

      const statusResponse = await fetch(`http://localhost:3000/api/jobs/${jobId}/status`);
      const statusData = await statusResponse.json();
      jobStatus = statusData.data.status;

      console.log(`   Status: ${jobStatus}, Cracked: ${statusData.data.cracked}/${statusData.data.totalHashes}`);
      attempts++;
    }

    if (jobStatus !== 'completed') {
      throw new Error(`Job failed or timed out with status: ${jobStatus}`);
    }

    console.log('✓ Job completed successfully!');

    // 7. Check for cracked passwords in database
    console.log('7. Checking database for cracked passwords...');
    const { execSync } = require('child_process');
    try {
      const dbResult = execSync(`PGPASSWORD=autopwn_password docker exec autopwn-postgres psql -U autopwn -d autopwn -c "SELECT COUNT(*) FROM cracked_passwords;"`, { encoding: 'utf8' });
      const count = parseInt(dbResult.split('\n')[2].trim());
      console.log(`✓ Found ${count} cracked passwords in database`);

      if (count > 0) {
        const passwords = execSync(`PGPASSWORD=autopwn_password docker exec autopwn-postgres psql -U autopwn -d autopwn -c "SELECT essid, plain_password, jobs.name FROM cracked_passwords JOIN networks ON cracked_passwords.network_id = networks.id JOIN jobs ON cracked_passwords.job_id = jobs.id;"`, { encoding: 'utf8' });
        console.log('Cracked passwords:');
        console.log(passwords);
      }
    } catch (error) {
      console.log('⚠ Could not check database:', error.message);
    }

    console.log('\n✅ Password storage test completed successfully!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testPasswordStorage();