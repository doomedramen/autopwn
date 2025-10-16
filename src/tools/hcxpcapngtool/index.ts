import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { join, resolve, dirname, basename } from 'path';
import { randomUUID } from 'crypto';
import {
  PcapInfo,
  NetworkInfo,
  ToolResult,
  ToolExecutionOptions,
} from '@/types';
import { logTool, logDebug, logWarn } from '@/lib/logger';

export interface HcxOptions {
  inputPcap: string;
  outputDirectory?: string;
  outputFormat?: 'hccapx' | 'cap' | 'json' | 'hc22000';
  includeWeak?: boolean;
  includeDuplicate?: boolean;
  essidFilter?: string[];
  bssidFilter?: string[];
  timeout?: number;
}

export interface HcxNetworkInfo {
  essid: string;
  bssid: string;
  channel: number;
  encryption: string;
  hasHandshake: boolean;
  hasKey?: boolean;
  key?: string;
  clientCount: number;
  firstSeen: Date;
  lastSeen: Date;
  packets: {
    total: number;
    handshake: number;
    eapol: number;
    beacon: number;
    probe: number;
  };
}

export class HcxPcapNgTool {
  private executablePath: string;
  private defaultTimeout: number = 30000; // 30 seconds

  constructor(executablePath: string = 'hcxpcapngtool') {
    this.executablePath = executablePath;
  }

  /**
   * Check if hcxpcapngtool is available and working
   */
  async isAvailable(): Promise<boolean> {
    try {
      const result = await this.execute('--version', { timeout: 5000 });
      return result.success && result.stdout.includes('hcxpcapngtool');
    } catch {
      return false;
    }
  }

  /**
   * Get version information
   */
  async getVersion(): Promise<string | null> {
    try {
      const result = await this.execute('--version', { timeout: 5000 });
      if (result.success) {
        const match = result.stdout.match(/hcxpcapngtool ([\d.]+)/);
        return match ? match[1] : null;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Analyze PCAP file for networks and handshakes
   */
  async analyzePcap(options: HcxOptions): Promise<ToolResult<PcapInfo>> {
    const startTime = Date.now();

    try {
      // Validate input file exists
      const inputFile = resolve(options.inputPcap);
      await fs.access(inputFile);

      // Ensure output directory exists
      const outputDir = options.outputDirectory
        ? resolve(options.outputDirectory)
        : dirname(inputFile);
      await fs.mkdir(outputDir, { recursive: true });

      // Build command arguments
      const args = this.buildCommandArgs(options);

      // Execute hcxpcapngtool
      const result = await this.execute(args.join(' '), {
        cwd: outputDir,
        timeout: options.timeout || this.defaultTimeout,
      });

      if (!result.success) {
        return {
          success: false,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
          executionTime: Date.now() - startTime,
        };
      }

      // Parse output and create PcapInfo
      const pcapInfo = await this.parseOutput(
        result.stdout,
        inputFile,
        outputDir
      );

      return {
        success: true,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        data: pcapInfo,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        stdout: '',
        stderr: error instanceof Error ? error.message : 'Unknown error',
        exitCode: -1,
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Process individual PCAP file to extract networks and create individual hash file
   * This is used during PCAP upload to create one .hc22000 file per PCAP
   */
  async processPcapForUpload(
    inputPcap: string,
    outputDirectory?: string
  ): Promise<
    ToolResult<{
      networks: HcxNetworkInfo[];
      hashFile: string;
      essidList: string[];
      pcapInfo: PcapInfo;
    }>
  > {
    const startTime = Date.now();

    try {
      const inputFile = resolve(inputPcap);
      // Always use dirname of the resolved inputFile to ensure absolute path
      const outputDir = outputDirectory
        ? resolve(outputDirectory)
        : dirname(inputFile);

      // Ensure output directory exists
      await fs.mkdir(outputDir, { recursive: true });

      // Generate unique filenames
      const baseName = basename(inputFile, '.pcap');
      const hashFile = join(outputDir, `${baseName}.hc22000`);
      const essidFile = join(outputDir, `${baseName}_essids.txt`);

      // First, extract networks and hash file using --all flag
      const extractArgs = ['--all', '-o', hashFile, '-E', essidFile, inputFile];

      const result = await this.execute(extractArgs.join(' '), {
        cwd: outputDir,
        timeout: this.defaultTimeout,
      });

      if (!result.success) {
        return {
          success: false,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
          executionTime: Date.now() - startTime,
        };
      }

      // Check if hash file was created and has content
      let hasValidHashes = false;
      try {
        const hashStats = await fs.stat(hashFile);
        hasValidHashes = hashStats.size > 0;
      } catch (error) {
        logWarn('Hash file not found or empty:', error);
      }

      // Parse network information from stderr output, or extract from hash file
      let networks = await this.parseNetworksFromStderr(result.stderr);

      // If stderr parsing didn't work, try extracting from the hash file directly
      if (networks.length === 0 && hasValidHashes) {
        networks = await this.extractNetworksFromHashFile(hashFile);
      }

      // Read ESSID list
      let essidList: string[] = [];
      try {
        const essidContent = await fs.readFile(essidFile, 'utf8');
        essidList = essidContent
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0);
      } catch (error) {
        logWarn('Failed to read ESSID list file:', error);
      }

      // Get file stats
      const fileStats = await fs.stat(inputFile);

      const pcapInfo: PcapInfo = {
        filename: baseName,
        path: inputFile,
        size: fileStats.size,
        checksum: '', // Would need to calculate this
        networks: networks.map(n => ({
          id: randomUUID(),
          essid: n.essid,
          bssid: n.bssid,
          channel: n.channel,
          encryption: n.encryption,
          hasHandshake: n.hasHandshake,
          firstSeen: new Date(),
          lastSeen: new Date(),
        })),
        isValid: networks.length > 0,
        errorMessage:
          networks.length === 0 ? 'No networks found in PCAP file' : undefined,
      };

      return {
        success: true,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        data: {
          networks,
          hashFile: hasValidHashes ? hashFile : '',
          essidList,
          pcapInfo,
        },
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        stdout: '',
        stderr: error instanceof Error ? error.message : 'Unknown error',
        exitCode: -1,
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Extract handshakes from PCAP file(s)
   */
  async extractHandshakes(
    inputPcap: string | string[],
    outputFile?: string,
    options: Partial<HcxOptions> = {}
  ): Promise<ToolResult<{ networks: HcxNetworkInfo[]; outputFile?: string }>> {
    const startTime = Date.now();

    try {
      // Handle single file or array of files
      const inputFiles = Array.isArray(inputPcap) ? inputPcap : [inputPcap];

      if (inputFiles.length === 0) {
        throw new Error('No input files provided');
      }

      // Resolve all input files
      const resolvedFiles = inputFiles.map(file => resolve(file));

      // Use provided outputFile or create one in the job directory
      const defaultOutputFile =
        outputFile || join(dirname(resolvedFiles[0]), `consolidated.hccapx`);

      // Check if all input files exist
      for (const file of resolvedFiles) {
        await fs.access(file);
      }

      // Ensure output directory exists
      const outputDir = dirname(defaultOutputFile);
      await fs.mkdir(outputDir, { recursive: true });

      // Check if we need .hc22000 format
      const isHc22000Format =
        options.outputFormat === 'hc22000' ||
        (outputFile && outputFile.endsWith('.hc22000'));

      if (isHc22000Format) {
        // For .hc22000 format, use direct hcxpcapngtool call with multiple input files
        const args = [];

        // Add output option FIRST (before input files)
        args.push('-o', defaultOutputFile);

        // Add essid list file option (required for hash file creation)
        const essidListFile = defaultOutputFile.replace(
          '.hc22000',
          '_essidlist.txt'
        );
        args.push('-E', essidListFile);

        // Add any additional options
        if (options.includeWeak) {
          args.push('-w');
        }
        if (options.includeDuplicate) {
          args.push('-d');
        }
        if (options.essidFilter && options.essidFilter.length > 0) {
          // Note: -E is already used for essid list, so we can't use it again for filter
          // Could add support for essid filtering later if needed
        }
        if (options.bssidFilter && options.bssidFilter.length > 0) {
          args.push('-I', options.bssidFilter.join(','));
        }

        // Add input files LAST
        args.push(...resolvedFiles);

        logTool(`Executing hcxpcapngtool with args:`, args);

        const result = await this.execute(args.join(' '), {
          cwd: process.cwd(), // Use project root as working directory
          timeout: options.timeout || this.defaultTimeout,
        });

        if (!result.success) {
          return {
            success: false,
            stdout: result.stdout,
            stderr: result.stderr,
            exitCode: result.exitCode,
            executionTime: Date.now() - startTime,
          };
        }

        // For .hc22000 format, we can't easily parse networks, so return empty array
        return {
          success: true,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
          data: {
            networks: [], // Networks will be parsed from job results instead
            outputFile: defaultOutputFile,
          },
          executionTime: Date.now() - startTime,
        };
      } else {
        // For legacy formats, process each file individually and combine
        const allNetworks: HcxNetworkInfo[] = [];

        for (const inputFile of resolvedFiles) {
          const hcxOptions: HcxOptions = {
            inputPcap: inputFile,
            outputDirectory: outputDir,
            outputFormat: 'hccapx',
            ...options,
          };

          const result = await this.analyzePcap(hcxOptions);

          if (result.success && result.data) {
            const networks = result.data.networks.map(
              this.convertToHcxNetworkInfo
            );
            allNetworks.push(...networks);
          }
        }

        return {
          success: true,
          stdout: '',
          stderr: '',
          exitCode: 0,
          data: {
            networks: allNetworks,
            outputFile: defaultOutputFile,
          },
          executionTime: Date.now() - startTime,
        };
      }
    } catch (error) {
      return {
        success: false,
        stdout: '',
        stderr: error instanceof Error ? error.message : 'Unknown error',
        exitCode: -1,
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Convert PCAP to different formats
   */
  async convertPcap(
    inputPcap: string,
    outputFormat: 'hccapx' | 'cap' | 'json',
    outputFile?: string
  ): Promise<ToolResult<string>> {
    const startTime = Date.now();

    try {
      const inputFile = resolve(inputPcap);
      const outputDir = dirname(inputFile);
      const defaultOutputFile =
        outputFile ||
        join(outputDir, `${basename(inputFile, '.pcap')}.${outputFormat}`);

      const hcxOptions: HcxOptions = {
        inputPcap,
        outputDirectory: outputDir,
        outputFormat,
      };

      const args = this.buildCommandArgs(hcxOptions);
      const result = await this.execute(args.join(' '), {
        cwd: outputDir,
        timeout: this.defaultTimeout,
      });

      return {
        success: result.success,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        data: result.success ? defaultOutputFile : undefined,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        stdout: '',
        stderr: error instanceof Error ? error.message : 'Unknown error',
        exitCode: -1,
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Build command arguments for hcxpcapngtool
   */
  private buildCommandArgs(options: HcxOptions): string[] {
    const args: string[] = [];

    // Input file
    args.push(options.inputPcap);

    // Output format
    if (options.outputFormat) {
      switch (options.outputFormat) {
        case 'hccapx':
          args.push('-o', 'output.hccapx');
          break;
        case 'cap':
          args.push('-o', 'output.cap');
          break;
        case 'json':
          args.push('-o', 'output.json');
          break;
        case 'hc22000':
          args.push('-o', 'output.hc22000');
          break;
      }
    }

    // Include weak networks
    if (options.includeWeak) {
      args.push('-w');
    }

    // Include duplicates
    if (options.includeDuplicate) {
      args.push('-d');
    }

    // ESSID filter
    if (options.essidFilter && options.essidFilter.length > 0) {
      args.push('-E', options.essidFilter.join(','));
    }

    // BSSID filter
    if (options.bssidFilter && options.bssidFilter.length > 0) {
      args.push('-I', options.bssidFilter.join(','));
    }

    // Verbose output
    args.push('-v');

    return args;
  }

  /**
   * Execute hcxpcapngtool command
   */
  private async execute(
    command: string,
    options: ToolExecutionOptions = {}
  ): Promise<{
    success: boolean;
    stdout: string;
    stderr: string;
    exitCode: number;
  }> {
    return new Promise(resolve => {
      const args = command.split(' ');
      logDebug(
        `[hcxpcapngtool] Spawning: ${this.executablePath} ${args.join(' ')}`
      );
      logDebug(`[hcxpcapngtool] Working directory: ${options.cwd}`);

      const child = spawn(this.executablePath, args, {
        cwd: options.cwd,
        env: { ...process.env, ...options.env },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', data => {
        const chunk = data.toString();
        stdout += chunk;
        logDebug(`[hcxpcapngtool] stdout:`, chunk.trim());
      });

      child.stderr?.on('data', data => {
        const chunk = data.toString();
        stderr += chunk;
        logDebug(`[hcxpcapngtool] stderr:`, chunk.trim());
      });

      const timeout = options.timeout || this.defaultTimeout;
      const timeoutId = setTimeout(() => {
        logDebug(
          `[hcxpcapngtool] Timeout after ${timeout}ms, killing process`
        );
        child.kill('SIGKILL');
        resolve({
          success: false,
          stdout,
          stderr: `Command timed out after ${timeout}ms`,
          exitCode: -1,
        });
      }, timeout);

      child.on('close', code => {
        clearTimeout(timeoutId);
        logDebug(`[hcxpcapngtool] Process closed with code: ${code}`);
        logDebug(`[hcxpcapngtool] Final stdout length: ${stdout.length}`);
        logDebug(`[hcxpcapngtool] Final stderr length: ${stderr.length}`);
        resolve({
          success: code === 0,
          stdout,
          stderr,
          exitCode: code || 0,
        });
      });

      child.on('error', error => {
        clearTimeout(timeoutId);
        logDebug(`[hcxpcapngtool] Process error:`, error);
        resolve({
          success: false,
          stdout,
          stderr: error.message,
          exitCode: -1,
        });
      });
    });
  }

  /**
   * Parse network information from hcxpcapngtool stderr output
   */
  private async parseNetworksFromStderr(
    stderr: string
  ): Promise<HcxNetworkInfo[]> {
    const networks: HcxNetworkInfo[] = [];
    const lines = stderr.split('\n');

    let currentBssid = '';
    let currentEssid = '';
    let currentChannel = 0;
    let hasHandshake = false;
    let encryption = 'Unknown';

    for (const line of lines) {
      // Look for ESSID information
      const essidMatch = line.match(/ESSID \(total unique\)[^:]*:\s*(\d+)/);
      if (essidMatch) {
        // ESSID count found, continue looking for actual SSIDs
        continue;
      }

      // Look for ESSID in the summary
      const essidListMatch = line.match(/ESSID:\s*(.+)/);
      if (essidListMatch) {
        currentEssid = essidListMatch[1].trim();
        continue;
      }

      // Look for BSSID in the summary
      const bssidMatch = line.match(/BSSID:\s*([a-fA-F0-9:]+)/i);
      if (bssidMatch) {
        currentBssid = bssidMatch[1].toLowerCase();
        continue;
      }

      // Look for channel information
      const channelMatch = line.match(/channel\s*(\d+)/i);
      if (channelMatch) {
        currentChannel = parseInt(channelMatch[1]);
        continue;
      }

      // Look for encryption information
      const encryptionMatch = line.match(/(WPA2?|WEP|OPEN)/i);
      if (encryptionMatch) {
        encryption = encryptionMatch[1];
        continue;
      }

      // Look for handshake information
      if (
        line.includes('EAPOL pairs written to 22000 hash file') &&
        parseInt(
          line.match(
            /EAPOL pairs written to 22000 hash file\.\.\. (\d+)/
          )?.[1] || '0'
        ) > 0
      ) {
        hasHandshake = true;
      }

      // If we have collected enough information, create a network entry
      if (currentBssid && currentEssid) {
        networks.push({
          essid: currentEssid,
          bssid: currentBssid,
          channel: currentChannel,
          encryption,
          hasHandshake,
          clientCount: 0,
          firstSeen: new Date(),
          lastSeen: new Date(),
          packets: {
            total: 0,
            handshake: hasHandshake ? 1 : 0,
            eapol: 0,
            beacon: 0,
            probe: 0,
          },
        });

        // Reset for next network
        currentBssid = '';
        currentEssid = '';
        currentChannel = 0;
        hasHandshake = false;
      }
    }

    return networks;
  }

  /**
   * Extract network information from hash file
   */
  private async extractNetworksFromHashFile(
    hashFilePath: string
  ): Promise<HcxNetworkInfo[]> {
    const networks: HcxNetworkInfo[] = [];

    try {
      // Check if hash file exists
      await fs.access(hashFilePath);

      // Read the hash file and extract network info from WPA* lines
      const hashContent = await fs.readFile(hashFilePath, 'utf8');
      const hashLines = hashContent
        .split('\n')
        .filter((line: string) => line.startsWith('WPA*'));

      const seenNetworks = new Set<string>();

      for (const line of hashLines) {
        // Parse WPA* format: WPA*type*pmk*ap_mac*client_mac*essid*...
        // parts[3] is the AP MAC (BSSID), parts[4] is client MAC
        const parts = line.split('*');
        if (parts.length >= 6) {
          const essidHex = parts[5];
          const bssidRaw = parts[3].toLowerCase(); // AP MAC address
          // Convert MAC address from xxxxxxxxxxxx to xx:xx:xx:xx:xx:xx format
          const bssid = bssidRaw.match(/.{1,2}/g)?.join(':') || bssidRaw;

          // Convert hex ESSID to string
          let essid = '';
          try {
            essid = Buffer.from(essidHex, 'hex').toString('utf8');
          } catch {
            essid = 'Unknown Network';
          }

          // Avoid duplicates
          const networkKey = `${bssid}-${essid}`;
          if (!seenNetworks.has(networkKey)) {
            seenNetworks.add(networkKey);
            networks.push({
              essid,
              bssid,
              channel: 0,
              encryption: 'WPA2', // Assume WPA2 for .hc22000 format
              hasHandshake: true, // All entries in .hc22000 have handshakes
              clientCount: 0,
              firstSeen: new Date(),
              lastSeen: new Date(),
              packets: {
                total: 0,
                handshake: 1,
                eapol: 0,
                beacon: 0,
                probe: 0,
              },
            });
          }
        }
      }
    } catch (error) {
      logWarn('Failed to parse hash file for network extraction:', error);
    }

    return networks;
  }

  /**
   * Parse hcxpcapngtool output to extract network information
   */
  private async parseOutput(
    stdout: string,
    inputFile: string,
    outputDir: string
  ): Promise<PcapInfo> {
    const networks: NetworkInfo[] = [];

    // Parse output lines to extract network information
    const lines = stdout.split('\n');

    for (const line of lines) {
      // Try to match network information patterns
      const networkMatch = line.match(
        /ESSID:\s*(.+?)\s+BSSID:\s*([a-fA-F0-9:]+)/
      );
      if (networkMatch) {
        const [, essid, bssid] = networkMatch;

        // Look for handshake indication
        const hasHandshake =
          line.includes('handshake') || line.includes('PMKID');

        // Try to extract channel information
        const channelMatch = line.match(/channel\s*(\d+)/i);
        const channel = channelMatch ? parseInt(channelMatch[1]) : undefined;

        // Try to extract encryption type
        const encryptionMatch = line.match(/(WPA2?|WEP|OPEN)/i);
        const encryption = encryptionMatch ? encryptionMatch[1] : undefined;

        networks.push({
          id: randomUUID(),
          essid,
          bssid,
          channel,
          encryption,
          hasHandshake,
          firstSeen: new Date(),
          lastSeen: new Date(),
        });
      }
    }

    // If we couldn't parse from stdout, try to read output files
    if (networks.length === 0) {
      const parsedNetworks = await this.tryParseOutputFiles(outputDir);
      networks.push(...parsedNetworks);
    }

    // Get file stats
    const fileStats = await fs.stat(inputFile);

    return {
      filename: basename(inputFile),
      path: inputFile,
      size: fileStats.size,
      checksum: '', // Would need to calculate this
      networks,
      isValid: networks.length > 0,
      errorMessage:
        networks.length === 0 ? 'No networks found in PCAP file' : undefined,
    };
  }

  /**
   * Try to parse output files created by hcxpcapngtool
   */
  private async tryParseOutputFiles(outputDir: string): Promise<NetworkInfo[]> {
    // Try to read and parse different output files
    const outputFiles = [
      join(outputDir, 'output.json'),
      join(outputDir, 'output.hccapx'),
      join(outputDir, 'output.cap'),
    ];

    for (const file of outputFiles) {
      try {
        await fs.access(file);

        if (file.endsWith('.json')) {
          const content = await fs.readFile(file, 'utf8');
          const parsedData = JSON.parse(content);
          // Parse JSON format and add to networks array
          // Implementation depends on hcxpcapngtool JSON format
          logDebug(`Parsed JSON output from ${file}:`, parsedData);
        }
        // For .hccapx and .cap files, we'd need specialized parsers
        // This is a simplified implementation
      } catch {
        // File doesn't exist or can't be parsed, continue
      }
    }

    return []; // Return empty array for now, would parse networks from output files
  }

  /**
   * Convert internal network info to HcxNetworkInfo format
   */
  private convertToHcxNetworkInfo(network: NetworkInfo): HcxNetworkInfo {
    return {
      essid: network.essid,
      bssid: network.bssid,
      channel: network.channel || 0,
      encryption: network.encryption || 'Unknown',
      hasHandshake: network.hasHandshake,
      clientCount: 0, // Would need to be parsed from PCAP
      firstSeen: network.firstSeen,
      lastSeen: network.lastSeen,
      packets: {
        total: 0,
        handshake: network.hasHandshake ? 1 : 0,
        eapol: 0,
        beacon: 0,
        probe: 0,
      },
    };
  }
}

// Create a default instance
export const hcxTool = new HcxPcapNgTool();
