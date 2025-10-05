import { readdir, stat, rename } from 'fs/promises';
import { join, basename } from 'path';
import { spawn } from 'child_process';
import { config } from './config.js';
import { db } from './database.js';
import { HashcatRunner } from './hashcat.js';

export class JobProcessor {
  private isProcessing = false;

  async start() {
    console.log('Job processor started');
    await this.scanDictionaries();
    this.processLoop();
  }

  private async processLoop() {
    while (true) {
      if (!this.isProcessing) {
        const job = db.getPendingJob();
        if (job) {
          await this.processJob(job.id);
        }
      }
      await this.sleep(2000);
    }
  }

  private async processJob(jobId: number) {
    this.isProcessing = true;
    const job = db.getJob(jobId);
    if (!job) {
      this.isProcessing = false;
      return;
    }

    console.log(`Processing job ${jobId}: ${job.filename}`);

    const logs: string[] = [];
    const addLog = (message: string) => {
      logs.push(`[${new Date().toISOString()}] ${message}`);
      db.updateJob(jobId, { logs: logs.join('\n') });
    };

    try {
      addLog(`Starting job for ${job.filename}`);
      db.updateJob(jobId, {
        status: 'processing',
        started_at: new Date().toISOString(),
      });

      const hashFile = join(config.hashesPath, `${job.filename}.hc22000`);
      const dictionaries = db.getAllDictionaries();

      if (dictionaries.length === 0) {
        throw new Error('No dictionaries found');
      }

      addLog(`Found ${dictionaries.length} dictionary/dictionaries`);
      addLog(`Hash count: ${job.hash_count}`);

      let cracked = false;

      for (const dictionary of dictionaries) {
        if (cracked) break;

        console.log(`Trying dictionary: ${dictionary.name}`);
        addLog(`Trying dictionary: ${dictionary.name}`);

        db.updateJob(jobId, {
          current_dictionary: dictionary.name,
          progress: 0,
        });

        const runner = new HashcatRunner();
        const result = await runner.run({
          hashFile,
          dictionaryFile: dictionary.path,
          deviceType: config.hashcatDeviceType,
          onProgress: (progress) => {
            db.updateJob(jobId, {
              progress: progress.progress,
              speed: progress.speed,
              eta: progress.eta,
            });
          },
          onCracked: (essid, password) => {
            console.log(`Cracked! ESSID: ${essid}, Password: ${password}`);
            addLog(`SUCCESS: Cracked ${essid} with password: ${password}`);
            db.createResult({
              job_id: jobId,
              essid,
              password,
            });
            cracked = true;
          },
          onLog: (message) => {
            // Capture important hashcat output
            if (message.includes('All hashes found') ||
                message.includes('Stopped:') ||
                message.includes('Recovered:') ||
                message.includes('exhausted')) {
              addLog(`Hashcat: ${message.trim()}`);
            }
          },
        });

        if (result.success) {
          cracked = true;
          addLog(`Dictionary ${dictionary.name} successful`);
        } else if (result.error) {
          console.error(`Error with dictionary ${dictionary.name}:`, result.error);
          addLog(`ERROR with ${dictionary.name}: ${result.error}`);
        } else {
          addLog(`Dictionary ${dictionary.name} exhausted, no matches found`);
        }
      }

      // Move file to appropriate folder
      const sourceFile = join(config.intermediatePath, job.filename);
      const destinationFolder = cracked ? config.completedPath : config.failedPath;
      const destinationFile = join(destinationFolder, job.filename);

      try {
        await rename(sourceFile, destinationFile);
        console.log(`Moved ${job.filename} to ${cracked ? 'completed' : 'failed'}`);
        addLog(`Moved file to ${cracked ? 'completed' : 'failed'} folder`);
      } catch (error) {
        console.error(`Failed to move file:`, error);
        addLog(`ERROR: Failed to move file: ${error}`);
      }

      const finalStatus = cracked ? 'completed' : 'failed';
      addLog(`Job ${finalStatus}: ${cracked ? 'Password cracked!' : 'No password found'}`);

      db.updateJob(jobId, {
        status: finalStatus,
        completed_at: new Date().toISOString(),
        progress: 100,
      });

      console.log(`Job ${jobId} finished: ${cracked ? 'cracked' : 'not cracked'}`);
    } catch (error) {
      console.error(`Job ${jobId} failed:`, error);
      addLog(`FATAL ERROR: ${error instanceof Error ? error.message : String(error)}`);
      db.updateJob(jobId, {
        status: 'failed',
        completed_at: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.isProcessing = false;
    }
  }

  private async scanDictionaries() {
    console.log('Scanning dictionaries...');
    try {
      const files = await readdir(config.dictionariesPath);
      const dictionaries = [];

      for (const file of files) {
        if (file.startsWith('.')) continue;
        const filePath = join(config.dictionariesPath, file);
        const stats = await stat(filePath);
        if (stats.isFile()) {
          dictionaries.push({
            name: file,
            path: filePath,
            size: stats.size,
          });
        }
      }

      db.syncDictionaries(dictionaries);
      console.log(`Found ${dictionaries.length} dictionaries`);
    } catch (error) {
      console.error('Failed to scan dictionaries:', error);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export async function convertPcapToHash(pcapFile: string, outputFile: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const process = spawn('hcxpcapngtool', ['-o', outputFile, pcapFile]);

    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      if (code === 0) {
        // Parse hash count from output
        // hcxpcapngtool typically outputs something like "written hashes: X"
        const match = stdout.match(/written hashes:\s*(\d+)/i) ||
                      stdout.match(/(\d+)\s+EAPOL/i);
        const hashCount = match ? parseInt(match[1]) : 1;
        resolve(hashCount);
      } else {
        reject(new Error(`hcxpcapngtool failed: ${stderr || stdout}`));
      }
    });

    process.on('error', (error) => {
      reject(error);
    });
  });
}
