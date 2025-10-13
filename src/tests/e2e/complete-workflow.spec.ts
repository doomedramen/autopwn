import { test, expect } from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';

const DICTIONARY_PATH = path.join(__dirname, '../fixtures/dictionaries/test-passwords.txt');
const PCAP_PATH = path.join(__dirname, '../fixtures/pcaps/wpa2-ikeriri-5g.pcap');

test.describe('Complete Workflow: Upload and Crack', () => {
  test('should upload dictionary, upload pcap, start job, and successfully crack password', async ({ request }) => {
    // Step 1: Upload dictionary
    console.log('📚 Uploading dictionary...');
    const dictionaryFile = await fs.readFile(DICTIONARY_PATH);
    const dictionaryFormData = new FormData();
    dictionaryFormData.append('file', new Blob([dictionaryFile]), 'test-passwords.txt');

    const dictionaryResponse = await request.post('/api/upload/dictionary', {
      multipart: {
        file: {
          name: 'test-passwords.txt',
          mimeType: 'text/plain',
          buffer: dictionaryFile,
        },
      },
    });

    expect(dictionaryResponse.ok()).toBeTruthy();
    const dictionaryData = await dictionaryResponse.json();
    expect(dictionaryData.success).toBe(true);
    expect(dictionaryData.data.dictionary).toBeDefined();

    const dictionaryId = dictionaryData.data.dictionary.id;
    const dictionaryPath = dictionaryData.data.dictionary.path;
    console.log(`✓ Dictionary uploaded with ID: ${dictionaryId}`);
    console.log(`  Dictionary path: ${dictionaryPath}`);

    // Step 2: Upload PCAP
    console.log('📦 Uploading PCAP...');
    const pcapFile = await fs.readFile(PCAP_PATH);

    const pcapResponse = await request.post('/api/upload/pcap', {
      multipart: {
        file: {
          name: 'wpa2-ikeriri-5g.pcap',
          mimeType: 'application/vnd.tcpdump.pcap',
          buffer: pcapFile,
        },
      },
    });

    expect(pcapResponse.ok()).toBeTruthy();
    const pcapData = await pcapResponse.json();
    expect(pcapData.success).toBe(true);
    expect(pcapData.data.networks).toBeDefined();
    expect(pcapData.data.networks.length).toBeGreaterThan(0);

    const networks = pcapData.data.networks;
    const networkBssids = networks.map((network: any) => network.bssid);
    const pcapPath = pcapData.data.upload.savedPath;
    console.log(`✓ PCAP uploaded with ${networks.length} network(s)`);
    console.log(`  Networks: ${networkBssids.join(', ')}`);
    console.log(`  PCAP path: ${pcapPath}`);

    // Step 3: Start job
    console.log('🚀 Starting cracking job...');
    const jobResponse = await request.post('/api/jobs', {
      data: {
        name: 'E2E Test Job',
        networks: networkBssids,
        dictionaries: [dictionaryId],
        options: {
          attackMode: 0, // Dictionary attack
          hashType: 22000,
          workloadProfile: 3,
          gpuTempAbort: 90,
          optimizedKernelEnable: true,
          potfileDisable: true, // Disable potfile for tests to ensure passwords are actually cracked
        },
      },
    });

    if (!jobResponse.ok()) {
      const errorData = await jobResponse.json();
      console.error('❌ Job creation failed:', errorData);
      throw new Error(`Job creation failed: ${JSON.stringify(errorData, null, 2)}`);
    }
    expect(jobResponse.ok()).toBeTruthy();
    const jobData = await jobResponse.json();
    expect(jobData.success).toBe(true);
    expect(jobData.data.id).toBeDefined();

    const jobId = jobData.data.id;
    console.log(`✓ Job started with ID: ${jobId}`);

    // Step 4: Wait for job to complete
    console.log('⏳ Waiting for job to complete...');
    let jobStatus;
    let attempts = 0;
    const maxAttempts = 120; // 2 minutes max (120 * 1 second)
    const pollInterval = 1000; // 1 second

    while (attempts < maxAttempts) {
      const statusResponse = await request.get(`/api/jobs/${jobId}/status`);
      expect(statusResponse.ok()).toBeTruthy();

      const statusData = await statusResponse.json();
      expect(statusData.success).toBe(true);

      jobStatus = statusData.data;
      console.log(`  Status: ${jobStatus.status}, Progress: ${jobStatus.progress}%, Cracked: ${jobStatus.cracked}/${jobStatus.totalHashes}`);

      if (jobStatus.status === 'completed' || jobStatus.status === 'cracked' || jobStatus.status === 'exhausted') {
        console.log(`✓ Job finished with status: ${jobStatus.status}`);
        break;
      }

      if (jobStatus.status === 'failed' || jobStatus.status === 'error') {
        console.error(`❌ Job failed with status: ${jobStatus.status}`);
        console.error(`   Error: ${jobStatus.errorMessage || 'Unknown error'}`);
        throw new Error(`Job failed: ${jobStatus.errorMessage || 'Unknown error'}`);
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
      attempts++;
    }

    if (attempts >= maxAttempts) {
      throw new Error('Job did not complete within the timeout period');
    }

    // Step 5: Verify job was successful
    console.log('✅ Verifying job results...');
    expect(jobStatus).toBeDefined();
    expect(['completed', 'cracked', 'exhausted']).toContain(jobStatus.status);

    // The password "wireshark" should be in our dictionary and should crack successfully
    expect(jobStatus.cracked).toBeGreaterThan(0);
    expect(jobStatus.totalHashes).toBeGreaterThan(0);

    console.log(`✓ Job completed successfully!`);
    console.log(`  Total hashes: ${jobStatus.totalHashes}`);
    console.log(`  Cracked: ${jobStatus.cracked}`);
    console.log(`  Progress: ${jobStatus.progress}%`);
  });
});
