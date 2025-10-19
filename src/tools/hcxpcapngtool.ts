import { exec } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import { readFileSync, existsSync } from 'fs';
import { logTool, logDebug, logError } from '@/lib/logger';

const execAsync = promisify(exec);

export interface NetworkInfo {
  essid: string;
  bssid: string;
  channel?: string | null;
  encryption?: string;
  hasHandshake: boolean;
  firstSeen: Date;
  lastSeen: Date;
}

export interface ProcessPcapResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  data?: {
    networks: NetworkInfo[];
    hashFile: string;
    outputFile?: string;
    essidList: string[];
    pcapInfo?: Record<string, unknown>;
  };
}

export class HcxPcapNgTool {
  private toolPath: string;

  constructor() {
    // Default path for hcxpcapngtool
    this.toolPath = '/usr/bin/hcxpcapngtool';
  }

  /**
   * Extract handshakes from multiple PCAP files and create consolidated hash file
   */
  async extractHandshakes(
    pcapFilePaths: string[],
    outputFile: string
  ): Promise<ProcessPcapResult> {
    try {
      // Check if hcxpcapngtool is available
      try {
        await execAsync(`which hcxpcapngtool`);
      } catch {
        // Tool not available, create failure result
        return {
          success: false,
          stdout: '',
          stderr:
            'hcxpcapngtool is not available. PCAP analysis requires this tool to be installed on the system.',
          exitCode: 1,
        };
      }

      // Process all PCAP files and consolidate
      const cmd = `${this.toolPath} -o ${outputFile} ${pcapFilePaths.join(' ')}`;
      const { stdout, stderr } = await execAsync(cmd);

      // Parse the generated hash file to extract network information
      const networks = await this.parseHashFile(outputFile);

      return {
        success: true,
        stdout,
        stderr,
        exitCode: 0,
        data: {
          networks,
          hashFile: outputFile,
          outputFile,
          essidList: networks.map(n => n.essid),
          pcapInfo: {
            consolidatedFrom: pcapFilePaths,
            processedAt: new Date().toISOString(),
            networksFound: networks.length,
            networksWithHandshakes: networks.filter(n => n.hasHandshake).length,
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        stdout: '',
        stderr: error instanceof Error ? error.message : 'Unknown error',
        exitCode: 1,
      };
    }
  }

  /**
   * Check if the hcxpcapngtool is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      await execAsync(`which hcxpcapngtool`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Analyze PCAP file for WiFi content
   */
  async analyzePcap(options: {
    inputPcap: string;
    outputFormat?: string;
  }): Promise<ProcessPcapResult> {
    try {
      // Check if hcxpcapngtool is available
      try {
        await execAsync(`which hcxpcapngtool`);
      } catch {
        // Tool not available, create failure result
        return {
          success: false,
          stdout: '',
          stderr:
            'hcxpcapngtool is not available. PCAP analysis requires this tool to be installed on the system.',
          exitCode: 1,
        };
      }

      const cmd = `${this.toolPath} ${options.inputPcap}`;
      const { stdout, stderr } = await execAsync(cmd);

      return {
        success: true,
        stdout,
        stderr,
        exitCode: 0,
        data: {
          networks: [],
          hashFile: '',
          essidList: [],
          pcapInfo: {
            hasWiFi: false,
            note: 'Basic analysis complete',
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        stdout: '',
        stderr: error instanceof Error ? error.message : 'Unknown error',
        exitCode: 1,
      };
    }
  }

  /**
   * Process PCAP file for upload - extract networks and create hash file
   */
  async processPcapForUpload(
    pcapPath: string,
    outputDir: string
  ): Promise<ProcessPcapResult> {
    try {
      // Generate hash file name based on PCAP file name
      const pcapBasename =
        pcapPath
          .split('/')
          .pop()
          ?.replace(/\.[^/.]+$/, '') || 'unknown';
      const hashFile = join(outputDir, `${pcapBasename}.hc22000`);

      // Check if hcxpcapngtool is available
      try {
        await execAsync(`which hcxpcapngtool`);
      } catch {
        // Tool not available, create failure result
        return {
          success: false,
          stdout: '',
          stderr:
            'hcxpcapngtool is not available. PCAP analysis requires this tool to be installed on the system.',
          exitCode: 1,
        };
      }

      // Run hcxpcapngtool to extract handshakes
      const cmd = `${this.toolPath} -o ${hashFile} ${pcapPath}`;
      const { stdout, stderr } = await execAsync(cmd);

      // Parse the generated hash file to extract network information
      const networks = await this.parseHashFile(hashFile);

      return {
        success: true,
        stdout,
        stderr,
        exitCode: 0,
        data: {
          networks,
          hashFile,
          essidList: networks.map(n => n.essid),
          pcapInfo: {
            fileSize: pcapPath,
            processedAt: new Date().toISOString(),
            networksFound: networks.length,
            networksWithHandshakes: networks.filter(n => n.hasHandshake).length,
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        stdout: '',
        stderr: error instanceof Error ? error.message : 'Unknown error',
        exitCode: 1,
      };
    }
  }

  /**
   * Parse hash file (.hc22000) to extract network information
   */
  private async parseHashFile(hashFile: string): Promise<NetworkInfo[]> {
    logTool(`Parsing hash file: ${hashFile}`);

    if (!existsSync(hashFile)) {
      logError(`Hash file does not exist: ${hashFile}`);
      return [];
    }

    try {
      const content = readFileSync(hashFile, 'utf8');
      const lines = content.trim().split('\n');
      logDebug(`Found ${lines.length} lines in hash file`);

      const networks: NetworkInfo[] = [];
      const seenNetworks = new Set<string>();

      for (const line of lines) {
        if (!line.trim()) continue;

        // Hash format: WPA*01*hash1*MAC_AP*hash2*ESSID*...rest
        // or: WPA*02*hash1*MAC_AP*hash2*ESSID*...handshake data...
        const parts = line.split('*');

        if (parts.length < 7) continue;

        const hashType = `${parts[0]}*${parts[1]}`; // WPA*01 (PMKID) or WPA*02 (EAPOL)
        // const hash1 = parts[2]; // Unused - needed for hash validation but not for network info
        const macAp = parts[3]; // AP MAC is in position 3 (e438838cbcbe)
        // const hash2 = parts[4]; // Unused - needed for hash validation but not for network info
        const essidHex = parts[5]; // ESSID is in position 5 (50696b6c205374616666)

        // Convert hex ESSID to string
        let essid;
        try {
          essid = Buffer.from(essidHex, 'hex').toString('utf8');
          // If conversion fails or results in empty string, use hex value
          if (!essid || essid.length === 0) {
            essid = essidHex;
          }
        } catch {
          essid = essidHex;
        }

        // Clean up ESSID (remove null bytes and other non-printable chars)
        essid = essid.replace(/[\x00-\x1F\x7F]/g, '').trim();

        // Create unique identifier for this network
        const networkKey = `${macAp}_${essid}`;

        if (seenNetworks.has(networkKey)) continue;
        seenNetworks.add(networkKey);

        // Determine if this network has a handshake
        // PMKID (WPA*01) is considered a handshake
        // EAPOL (WPA*02) contains actual handshake data
        const hasHandshake = hashType.includes('WPA');

        networks.push({
          essid,
          bssid: macAp.replace(
            /(.{2})(.{2})(.{2})(.{2})(.{2})(.{2})/,
            '$1:$2:$3:$4:$5:$6'
          ),
          channel: null, // HC22000 format doesn't include channel information
          encryption: 'WPA2',
          hasHandshake,
          firstSeen: new Date(),
          lastSeen: new Date(),
        });
      }

      logTool(`Parsed ${networks.length} networks successfully`);
      return networks;
    } catch (error) {
      logError('Error parsing hash file:', error);
      return [];
    }
  }
}
