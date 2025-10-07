import { spawn } from 'child_process';
import { HashcatProgress } from '@autopwn/shared';

export interface HashcatOptions {
  hashFile: string;
  dictionaryFile: string;
  deviceType?: string;
  onProgress?: (progress: HashcatProgress) => void;
  onCracked?: (essid: string, password: string) => void;
  onLog?: (message: string) => void;
}

export class HashcatRunner {
  private process: ReturnType<typeof spawn> | null = null;

  async run(options: HashcatOptions): Promise<{ success: boolean; error?: string }> {
    // First, check if passwords are already in potfile
    await this.checkPotfile(options);

    return new Promise((resolve) => {
      const args = [
        '-m', '22000',
        '--status',
        '--status-timer', '2',
        '-o', `${options.hashFile}.cracked`,
        '--outfile-format', '2',
        options.hashFile,
        options.dictionaryFile,
      ];

      // Device selection based on type
      if (options.deviceType && options.deviceType !== 'cpu') {
        args.push('-D', this.getDeviceFlag(options.deviceType));
      }

      this.process = spawn('hashcat', args);

      let stderr = '';
      let lastProgress: HashcatProgress | null = null;

      this.process.stdout?.on('data', (data) => {
        const output = data.toString();
        console.log('[hashcat]', output);

        // Send to log callback
        options.onLog?.(output);

        // Parse hashcat status output
        const progress = this.parseProgress(output);
        if (progress) {
          lastProgress = progress;
          options.onProgress?.(progress);
        }
      });

      this.process.stderr?.on('data', (data) => {
        stderr += data.toString();
        console.error('[hashcat error]', data.toString());
      });

      this.process.on('close', (code) => {
        this.process = null;

        // Check if any passwords were cracked
        if (code === 0) {
          // Read cracked passwords from output file
          this.readCrackedPasswords(options.hashFile).then((cracked) => {
            cracked.forEach(({ essid, password }) => {
              options.onCracked?.(essid, password);
            });
            resolve({ success: cracked.length > 0 });
          }).catch((error) => {
            // If the cracked file doesn't exist, that's okay - it means no passwords were found
            console.log('No cracked output file found - no passwords cracked');
            resolve({ success: false, error: 'No passwords found' });
          });
        } else {
          resolve({
            success: false,
            error: stderr || `Hashcat exited with code ${code}`
          });
        }
      });

      this.process.on('error', (error) => {
        this.process = null;
        resolve({ success: false, error: error.message });
      });
    });
  }

  private getDeviceFlag(deviceType: string): string {
    switch (deviceType.toLowerCase()) {
      case 'nvidia':
      case 'amd':
        return '2'; // GPU
      case 'intel':
        return '3'; // FPGA/OpenCL
      default:
        return '1'; // CPU
    }
  }

  private parseProgress(output: string): HashcatProgress | null {
    // Parse hashcat status output
    // Example: "Progress........: 1234/5678 (21.73%)"
    // Example: "Speed.#1........:  1234.5 kH/s"
    // Example: "Time.Estimated..: Wed Dec 20 12:34:56 2023"

    const progressMatch = output.match(/Progress[.\s]*:\s*(\d+)\/(\d+)\s*\(([0-9.]+)%\)/);
    const speedMatch = output.match(/Speed[.\s#\d]*:\s*([0-9.]+\s*[kMGT]?H\/s)/);
    const etaMatch = output.match(/Time\.Estimated[.\s]*:\s*(.+)/);
    const recoveredMatch = output.match(/Recovered[.\s]*:\s*(\d+)\/(\d+)/);

    if (progressMatch || speedMatch || recoveredMatch) {
      return {
        progress: progressMatch ? parseFloat(progressMatch[3]) : 0,
        speed: speedMatch ? speedMatch[1].trim() : '0 H/s',
        eta: etaMatch ? etaMatch[1].trim() : 'Unknown',
        recovered: recoveredMatch ? parseInt(recoveredMatch[1]) : 0,
        total: recoveredMatch ? parseInt(recoveredMatch[2]) : 0,
      };
    }

    return null;
  }

  private async readCrackedPasswords(hashFile: string): Promise<Array<{ essid: string; password: string }>> {
    const { readFile, access, constants } = await import('fs/promises');
    const crackedFile = `${hashFile}.cracked`;

    try {
      await access(crackedFile, constants.F_OK);
      const content = await readFile(crackedFile, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);

      if (lines.length === 0) {
        console.log('Cracked output file is empty');
        return [];
      }

      console.log(`Reading ${lines.length} lines from cracked output file`);
      return lines.map(line => {
        // Format: ESSID:password or hash:ESSID:password
        const parts = line.split(':');
        if (parts.length >= 2) {
          // Try to extract ESSID and password
          // hashcat output format for 22000 is typically: hash:essid:password
          const essid = parts.length >= 3 ? parts[parts.length - 2] : 'Unknown';
          const password = parts[parts.length - 1];
          return { essid, password };
        }
        return { essid: 'Unknown', password: line };
      });
    } catch (error) {
      // If file doesn't exist or can't be accessed, return empty array
      console.log('Cracked output file not accessible, assuming no passwords cracked');
      throw error; // Re-throw so the caller can handle it appropriately
    }
  }

  private async checkPotfile(options: HashcatOptions): Promise<void> {
    return new Promise((resolve) => {
      console.log('Checking potfile with --show...');

      // Use hashcat --show to display already cracked hashes from potfile
      // Don't use --outfile-format, it will show full format by default
      const showProcess = spawn('hashcat', [
        '-m', '22000',
        '--show',
        options.hashFile,
      ]);

      let output = '';
      let stderr = '';

      showProcess.stdout?.on('data', (data) => {
        const text = data.toString();
        output += text;
        console.log('[hashcat --show]', text);
      });

      showProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      showProcess.on('close', (code) => {
        console.log(`hashcat --show exited with code ${code}`);
        console.log('Output:', output);
        console.log('Stderr:', stderr);

        // Parse output for already cracked passwords
        // Format: hash:mac:mac:essid:password
        const lines = output.trim().split('\n').filter(Boolean);
        console.log(`Found ${lines.length} lines in potfile output`);

        for (const line of lines) {
          const parts = line.split(':');
          console.log(`Parsing line with ${parts.length} parts:`, line);

          // Need at least 5 parts: hash:mac:mac:essid:password
          if (parts.length >= 5) {
            const essid = parts[3];
            const password = parts.slice(4).join(':'); // In case password contains ':'
            if (password && password.length > 0) {
              console.log(`Found in potfile: ${essid} = ${password}`);
              options.onCracked?.(essid, password);
              options.onLog?.(`Found in potfile: ${essid} = ${password}`);
            }
          }
        }
        resolve();
      });

      showProcess.on('error', (err) => {
        console.error('hashcat --show error:', err);
        resolve(); // Continue even if --show fails
      });
    });
  }

  stop() {
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
    }
  }
}
