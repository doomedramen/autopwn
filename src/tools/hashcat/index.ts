import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import {
  HashcatOptions,
  HashcatResult,
  HashcatSession,
  ToolResult,
  ToolExecutionOptions,
  JobStatus,
} from '@/types';
import { logTool, logDebug, logError } from '@/lib/logger';

export interface HashcatJob {
  id: string;
  name: string;
  hashFile: string;
  dictionaries: string[];
  options: HashcatOptions;
  status: JobStatus;
  progress: number;
  speed: {
    current: number;
    average: number;
    unit: string;
  };
  eta: string;
  cracked: number;
  total: number;
  currentDictionary?: string;
  session?: string;
  startTime?: Date;
  endTime?: Date;
  error?: string;
}

export interface HashcatDeviceInfo {
  deviceId: number;
  type: 'cpu' | 'gpu' | 'accelerator';
  name: string;
  version: string;
  memory: number;
  cores?: number;
  clockSpeed?: number;
  temperature?: number;
  utilization?: number;
}

// Use globalThis to share state across all module instances in Next.js
declare global {
  var hashcatActiveSessions: Map<string, ChildProcess> | undefined;
  var hashcatSessionStatus: Map<string, HashcatSession> | undefined;
  var hashcatSessionOutputBuffer: Map<string, string[]> | undefined;
}

// Initialize global state if not already present
if (!globalThis.hashcatActiveSessions) {
  globalThis.hashcatActiveSessions = new Map();
  logDebug('[hashcat] Initialized global hashcatActiveSessions');
}
if (!globalThis.hashcatSessionStatus) {
  globalThis.hashcatSessionStatus = new Map();
  logDebug('[hashcat] Initialized global hashcatSessionStatus');
}
if (!globalThis.hashcatSessionOutputBuffer) {
  globalThis.hashcatSessionOutputBuffer = new Map();
  logDebug('[hashcat] Initialized global hashcatSessionOutputBuffer');
}

export class HashcatWrapper {
  private executablePath: string;
  private defaultTimeout: number = 60000; // 60 seconds
  // Use globalThis for shared state across all instances
  private get activeSessions(): Map<string, ChildProcess> {
    return globalThis.hashcatActiveSessions!;
  }
  private get sessionStatus(): Map<string, HashcatSession> {
    return globalThis.hashcatSessionStatus!;
  }
  private get sessionOutputBuffer(): Map<string, string[]> {
    return globalThis.hashcatSessionOutputBuffer!;
  }
  private readonly MAX_BUFFER_LINES = 100; // Keep last 100 lines
  private static instanceCount = 0;
  private instanceId: number;

  constructor(executablePath: string = 'hashcat') {
    this.executablePath = executablePath;
    this.instanceId = ++HashcatWrapper.instanceCount;
    logTool(
      `[hashcat] NEW INSTANCE CREATED! Instance #${this.instanceId}, Total instances: ${HashcatWrapper.instanceCount}`
    );
  }

  /**
   * Check if hashcat is available and working
   */
  async isAvailable(): Promise<boolean> {
    try {
      const result = await this.execute('--version', { timeout: 5000 });
      return result.success && result.stdout.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Get hashcat version information
   */
  async getVersion(): Promise<string | null> {
    try {
      const result = await this.execute('--version', { timeout: 5000 });
      if (result.success) {
        const match = result.stdout.match(/^v?([\d.]+)/);
        return match ? match[1] : null;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Get available devices
   */
  async getDevices(): Promise<ToolResult<HashcatDeviceInfo[]>> {
    const startTime = Date.now();

    try {
      const result = await this.execute('-I', { timeout: 10000 });

      if (!result.success) {
        return {
          success: false,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
          executionTime: Date.now() - startTime,
        };
      }

      const devices = this.parseDeviceList(result.stdout);

      return {
        success: true,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        data: devices,
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
   * Get supported hash types
   */
  async getHashTypes(): Promise<
    ToolResult<{ id: number; name: string; category: string }[]>
  > {
    const startTime = Date.now();

    try {
      const result = await this.execute('--help', { timeout: 15000 });

      if (!result.success) {
        return {
          success: false,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
          executionTime: Date.now() - startTime,
        };
      }

      const hashTypes = this.parseHashTypes(result.stdout);

      return {
        success: true,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        data: hashTypes,
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
   * Create and start a new cracking job
   */
  async startJob(job: HashcatJob): Promise<ToolResult<{ sessionId: string }>> {
    const startTime = Date.now();

    try {
      // Validate input files exist
      await fs.access(job.hashFile);
      for (const dict of job.dictionaries) {
        await fs.access(dict);
      }

      // Generate session name if not provided
      const sessionName =
        job.session ||
        `${job.name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;

      // Build command arguments
      const args = this.buildCommandArgs(job, sessionName);

      // Start hashcat process
      logTool(
        `[hashcat #${this.instanceId}] Starting session ${sessionName} with args:`,
        args
      );

      let child: ChildProcess;
      try {
        child = spawn(this.executablePath, args, {
          stdio: ['pipe', 'pipe', 'pipe'],
          detached: false,
        });
      } catch (spawnError) {
        // Handle ENOENT and other spawn errors immediately
        if (
          spawnError instanceof Error &&
          spawnError.message.includes('ENOENT')
        ) {
          const errorMsg = `Hashcat binary not found. Please install hashcat on the system. Command: '${this.executablePath}'`;
          logError(`[hashcat] ${errorMsg}`);
          job.status = 'failed';
          job.error = errorMsg;
          return {
            success: false,
            stdout: '',
            stderr: errorMsg,
            exitCode: -1,
            executionTime: Date.now() - startTime,
          };
        }
        throw spawnError;
      }

      // Log process PID
      logDebug(
        `[hashcat #${this.instanceId}] Spawned process with PID: ${child.pid}`
      );

      // Store active session
      this.activeSessions.set(sessionName, child);

      // Initialize output buffer and status cache
      this.sessionOutputBuffer.set(sessionName, []);
      this.sessionStatus.set(sessionName, {
        name: sessionName,
        status: 'processing',
        progress: 0,
        speed: { current: 0, average: 0, unit: 'H/s' },
        eta: '',
        cracked: 0,
        total: job.total || 0,
        currentDictionary: '',
      });
      logDebug(
        `[hashcat] Initialized cache for session: ${sessionName}, total cached sessions: ${this.sessionStatus.size}`
      );

      // Attach stdout listener to parse status updates in real-time
      child.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();
        logDebug(
          `[hashcat] ${sessionName} stdout:`,
          output.substring(0, 200)
        );
        this.appendToBuffer(sessionName, output);
        this.parseAndUpdateStatus(sessionName);
      });

      // Attach stderr listener (hashcat outputs status to stderr)
      child.stderr?.on('data', (data: Buffer) => {
        const output = data.toString();
        logDebug(
          `[hashcat] ${sessionName} stderr:`,
          output.substring(0, 200)
        );
        this.appendToBuffer(sessionName, output);
        this.parseAndUpdateStatus(sessionName);
      });

      // Handle process completion
      child.on('exit', (code, signal) => {
        logDebug(
          `[hashcat] Session ${sessionName} exited with code ${code}, signal ${signal}`
        );

        const currentStatus = this.sessionStatus.get(sessionName);
        if (currentStatus) {
          if (code === 0) {
            currentStatus.status = 'completed';
          } else {
            currentStatus.status = 'stopped';
          }
          this.sessionStatus.set(sessionName, currentStatus);
        }
      });

      // Handle process errors
      child.on('error', error => {
        logError(`[hashcat] Session ${sessionName} error:`, error);

        // Provide better error message for ENOENT
        let errorMessage = error.message;
        if (error.message.includes('ENOENT')) {
          errorMessage = `Hashcat binary not found. Please install hashcat on the system. Command: '${this.executablePath}'`;
          logError(`[hashcat] ${errorMessage}`);
        }

        const currentStatus = this.sessionStatus.get(sessionName);
        if (currentStatus) {
          currentStatus.status = 'stopped';
          currentStatus.error = errorMessage;
          this.sessionStatus.set(sessionName, currentStatus);
        }
      });

      // Log when process is spawned successfully
      logDebug(
        `[hashcat] Session ${sessionName} process started successfully`
      );

      // Update job status
      job.status = 'processing';
      job.session = sessionName;
      job.startTime = new Date();

      return {
        success: true,
        stdout: `Started hashcat session: ${sessionName}`,
        stderr: '',
        exitCode: 0,
        data: { sessionId: sessionName },
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Unknown error';

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
   * Get status of an active job from cached status
   */
  async getJobStatus(sessionName: string): Promise<ToolResult<HashcatSession>> {
    const startTime = Date.now();

    try {
      // Get cached status instead of querying hashcat externally
      const allSessions = Array.from(this.sessionStatus.keys());
      logDebug(
        `[hashcat #${this.instanceId}] getJobStatus called for: ${sessionName}`
      );
      logDebug(
        `[hashcat #${this.instanceId}] Cached sessions (${this.sessionStatus.size}):`,
        allSessions
      );

      const cachedStatus = this.sessionStatus.get(sessionName);

      if (!cachedStatus) {
        logError(
          `[hashcat] ERROR: No cache found for session: ${sessionName}`
        );
        logError(`[hashcat] Available sessions:`, allSessions);
        return {
          success: false,
          stdout: '',
          stderr: `No cached status found for session: ${sessionName}`,
          exitCode: 1,
          executionTime: Date.now() - startTime,
        };
      }

      return {
        success: true,
        stdout: 'Retrieved cached status',
        stderr: '',
        exitCode: 0,
        data: cachedStatus,
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
   * Pause a running job
   */
  async pauseJob(sessionName: string): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const result = await this.execute(`--session ${sessionName} --pause`, {
        timeout: 5000,
      });

      return {
        success: result.success,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
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
   * Resume a paused job
   */
  async resumeJob(sessionName: string): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const result = await this.execute(`--session ${sessionName} --resume`, {
        timeout: 5000,
      });

      return {
        success: result.success,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
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
   * Stop/abort a job
   */
  async stopJob(sessionName: string): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      // Kill the active process
      const child = this.activeSessions.get(sessionName);
      if (child) {
        child.kill('SIGTERM');
        setTimeout(() => {
          if (!child.killed) {
            child.kill('SIGKILL');
          }
        }, 5000);
        this.activeSessions.delete(sessionName);
      }

      // Clean up cached status and buffer
      this.sessionStatus.delete(sessionName);
      this.sessionOutputBuffer.delete(sessionName);

      // Also send quit command to hashcat
      const result = await this.execute(`--session ${sessionName} --quit`, {
        timeout: 5000,
      });

      return {
        success: true,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
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
   * Get cracked passwords from potfile
   */
  async getResults(
    hashFile: string,
    potfilePath?: string
  ): Promise<ToolResult<HashcatResult[]>> {
    const startTime = Date.now();

    try {
      const defaultPotfile =
        potfilePath ||
        join(process.env.HOME || '', '.hashcat', 'hashcat.potfile');

      // Check if potfile exists
      await fs.access(defaultPotfile);

      const potfileContent = await fs.readFile(defaultPotfile, 'utf8');
      const results = this.parsePotfile(potfileContent);

      return {
        success: true,
        stdout: `Found ${results.length} cracked passwords`,
        stderr: '',
        exitCode: 0,
        data: results,
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
   * Build command arguments for hashcat
   */
  private buildCommandArgs(job: HashcatJob, sessionName: string): string[] {
    const args: string[] = [];

    // Session management
    args.push('--session', sessionName);

    // Force CPU-only device (device ID 1 is typically CPU)
    args.push('-d', '1');

    // Hash type
    args.push('-m', job.options.hashType.toString());

    // Attack mode
    args.push('-a', job.options.attackMode.toString());

    // Workload profile (lower for CPU to avoid overheating)
    if (job.options.workloadProfile) {
      // Cap workload profile at 2 for CPU-only to avoid excessive CPU usage
      const workloadProfile = Math.min(job.options.workloadProfile, 2);
      args.push('-w', workloadProfile.toString());
    } else {
      // Default to workload profile 2 (medium) for CPU-only
      args.push('-w', '2');
    }

    // Disable potfile if requested
    if (job.options.potfileDisable) {
      args.push('--potfile-disable');
    }

    // Force CPU-only mode - disable all GPU-related optimizations
    // Note: CPU-only so no GPU temperature monitoring needed
    if (job.options.gpuTempAbort) {
      args.push('--hwmon-temp-abort', job.options.gpuTempAbort.toString());
    }

    // Force CPU-only mode - disable hardware monitoring for GPU features
    if (job.options.gpuTempDisable) {
      args.push('--hwmon-disable');
    }

    // NEVER use optimized kernel (-O) flag as it's GPU-only
    // Remove optimizedKernelEnable check to ensure CPU-only compatibility

    // Rules
    if (job.options.rules && job.options.rules.length > 0) {
      for (const rule of job.options.rules) {
        args.push('-r', rule);
      }
    }

    // Mask (for mask attack)
    if (job.options.mask) {
      args.push(job.options.mask);
    }

    // Hash file
    args.push(job.hashFile);

    // Dictionary files
    args.push(...job.dictionaries);

    // Status update interval - every 1 second for real-time monitoring
    args.push('--status', '--status-timer=1');

    return args;
  }

  /**
   * Execute hashcat command
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
      const child = spawn(this.executablePath, args, {
        cwd: options.cwd,
        env: { ...process.env, ...options.env },
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', data => {
        stdout += data.toString();
      });

      child.stderr?.on('data', data => {
        stderr += data.toString();
      });

      const timeout = options.timeout || this.defaultTimeout;
      const timeoutId = setTimeout(() => {
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
        resolve({
          success: code === 0,
          stdout,
          stderr,
          exitCode: code || 0,
        });
      });

      child.on('error', error => {
        clearTimeout(timeoutId);
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
   * Parse device list from hashcat output
   */
  private parseDeviceList(output: string): HashcatDeviceInfo[] {
    const devices: HashcatDeviceInfo[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      // Match different device information formats
      // Format 1: Backend Device ID #01 (Alias: #02)
      const deviceIdMatch = line.match(/Backend Device ID #(\d+)/);
      if (deviceIdMatch) {
        // Look for device info in subsequent lines
        const deviceInfo: Partial<HashcatDeviceInfo> = {
          deviceId: parseInt(deviceIdMatch[1]),
        };

        // Parse next few lines for device details
        const linesArray = output.split('\n');
        const currentIndex = linesArray.indexOf(line);

        for (
          let i = currentIndex;
          i < Math.min(currentIndex + 10, linesArray.length);
          i++
        ) {
          const infoLine = linesArray[i];

          // Type information
          if (infoLine.includes('Type...........:')) {
            const typeMatch = infoLine.match(/Type...........:\s*(.+)/);
            if (typeMatch) {
              const typeStr = typeMatch[1].trim().toLowerCase();
              if (typeStr.includes('gpu')) {
                deviceInfo.type = 'gpu';
              } else if (typeStr.includes('cpu')) {
                deviceInfo.type = 'cpu';
              } else {
                deviceInfo.type = 'accelerator';
              }
            }
          }

          // Name information
          if (infoLine.includes('Name...........:')) {
            const nameMatch = infoLine.match(/Name...........:\s*(.+)/);
            if (nameMatch) {
              deviceInfo.name = nameMatch[1].trim();
            }
          }

          // Memory information
          if (infoLine.includes('Memory.Total...:')) {
            const memoryMatch = infoLine.match(/Memory.Total...:\s*(\d+)\s*MB/);
            if (memoryMatch) {
              deviceInfo.memory = parseInt(memoryMatch[1]) * 1024 * 1024; // Convert MB to bytes
            }
          }

          // Version information
          if (infoLine.includes('Version........:')) {
            const versionMatch = infoLine.match(/Version........:\s*(.+)/);
            if (versionMatch) {
              deviceInfo.version = versionMatch[1].trim();
            }
          }
        }

        // Only add if we have basic info
        if (deviceInfo.name && deviceInfo.type) {
          devices.push({
            deviceId: deviceInfo.deviceId!,
            type: deviceInfo.type!,
            name: deviceInfo.name!,
            version: deviceInfo.version || 'Unknown',
            memory: deviceInfo.memory || 0,
          });
        }
      }
    }

    return devices;
  }

  /**
   * Parse hash types from hashcat help output
   */
  private parseHashTypes(
    output: string
  ): { id: number; name: string; category: string }[] {
    const hashTypes: { id: number; name: string; category: string }[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      // Match hash type lines
      const hashMatch = line.match(/^\s*(\d+)\s+\|\s+(.+?)\s+\|\s+(.+?)\s*$/);
      if (hashMatch) {
        const [, id, name, category] = hashMatch;
        hashTypes.push({
          id: parseInt(id),
          name: name.trim(),
          category: category.trim(),
        });
      }
    }

    return hashTypes;
  }

  /**
   * Append output to buffer, keeping only last MAX_BUFFER_LINES lines
   */
  private appendToBuffer(sessionName: string, output: string): void {
    const buffer = this.sessionOutputBuffer.get(sessionName) || [];
    const lines = output.split('\n');

    buffer.push(...lines);

    // Keep only last MAX_BUFFER_LINES lines
    if (buffer.length > this.MAX_BUFFER_LINES) {
      buffer.splice(0, buffer.length - this.MAX_BUFFER_LINES);
    }

    this.sessionOutputBuffer.set(sessionName, buffer);
  }

  /**
   * Parse buffer and update cached status for a session
   */
  private parseAndUpdateStatus(sessionName: string): void {
    const buffer = this.sessionOutputBuffer.get(sessionName);
    if (!buffer || buffer.length === 0) {
      return;
    }

    // Join buffer lines to parse
    const output = buffer.join('\n');

    // Parse status using existing method
    const parsedStatus = this.parseSessionStatus(output, sessionName);

    // Update the cached status
    this.sessionStatus.set(sessionName, parsedStatus);
  }

  /**
   * Parse session status from hashcat output
   */
  private parseSessionStatus(
    output: string,
    sessionName: string
  ): HashcatSession {
    const session: HashcatSession = {
      name: sessionName,
      status: 'processing',
      progress: 0,
      speed: { current: 0, average: 0, unit: 'H/s' },
      eta: '',
      cracked: 0,
      total: 0,
      currentDictionary: '',
    };

    const lines = output.split('\n');

    // Count unique cracked passwords (WPA2 hashes in format: hash:mac:mac:essid:password)
    const uniqueCrackedHashes = new Set<string>();
    for (const line of lines) {
      // Match WPA2/WPA3 cracked password format (hash:bssid:ap_mac:essid:password)
      // The line should have exactly 5 colon-separated fields and look like a hex hash at the start
      if (/^[a-f0-9]{32}:[a-f0-9]{12}:[a-f0-9]{12}:.+:.+$/i.test(line.trim())) {
        const hash = line.trim().split(':')[0];
        uniqueCrackedHashes.add(hash);
      }
    }
    const crackedCount = uniqueCrackedHashes.size;

    for (const line of lines) {
      // Parse progress - handle both "Progress.:" and "Progress.........:" formats
      const progressMatch = line.match(
        /Progress\.+:?\s*(\d+)\/(\d+)\s*\(([\d.]+)%\)/
      );
      if (progressMatch) {
        session.cracked = parseInt(progressMatch[1]);
        session.total = parseInt(progressMatch[2]);
        session.progress = parseFloat(progressMatch[3]);
      }

      // Parse "Recovered" line which shows actual cracked count
      const recoveredMatch = line.match(/Recovered\.+:?\s*(\d+)\/(\d+)/);
      if (recoveredMatch) {
        session.cracked = parseInt(recoveredMatch[1]);
        session.total = parseInt(recoveredMatch[2]);
      }

      // Parse speed - handle formats like "Speed.#1.........:" and "Speed.#1.?:"
      const speedMatch = line.match(/Speed\.#?\d*\.+:?\s*([\d.]+)\s*(.+)\/s/);
      if (speedMatch) {
        session.speed.current = parseFloat(speedMatch[1]);
        session.speed.unit = speedMatch[2];
      }

      // Parse ETA - handle formats like "Time.Estimated...:" and "Time.Estimated.:"
      const etaMatch = line.match(/Time\.Estimated\.+:?\s*(.+)/);
      if (etaMatch) {
        session.eta = etaMatch[1].trim();
      }

      // Parse current dictionary - handle formats like "Dictionary.......:" and "Dictionary.:"
      const dictMatch = line.match(/Dictionary\.+:?\s*(.+)/);
      if (dictMatch) {
        // Extract just the filename, removing any additional info in parentheses
        const dictWithInfo = dictMatch[1].trim();
        const dictOnly = dictWithInfo.split(/\s*\(/)[0].trim();
        session.currentDictionary = dictOnly;
      }

      // Parse status - check more comprehensive patterns with case-insensitive matching
      if (line.includes('Status')) {
        const statusLine = line.toLowerCase();
        if (
          statusLine.includes('stopped') ||
          statusLine.includes('aborted') ||
          statusLine.includes('killed')
        ) {
          session.status = 'stopped';
        } else if (
          statusLine.includes('paused') ||
          statusLine.includes('suspended')
        ) {
          session.status = 'paused';
        } else if (
          statusLine.includes('completed') ||
          statusLine.includes('finished') ||
          statusLine.includes('cracked') ||
          statusLine.includes('exhausted')
        ) {
          session.status = 'completed';
        } else if (
          statusLine.includes('running') ||
          statusLine.includes('processing')
        ) {
          session.status = 'processing';
        }
      }

      // Also check for session status patterns
      if (line.includes('Session')) {
        const sessionLine = line.toLowerCase();
        if (
          sessionLine.includes('stopped') ||
          sessionLine.includes('aborted') ||
          sessionLine.includes('killed')
        ) {
          session.status = 'stopped';
        } else if (
          sessionLine.includes('paused') ||
          sessionLine.includes('suspended')
        ) {
          session.status = 'paused';
        } else if (
          sessionLine.includes('completed') ||
          sessionLine.includes('finished') ||
          sessionLine.includes('cracked') ||
          sessionLine.includes('exhausted')
        ) {
          session.status = 'completed';
        }
      }
    }

    // Use cracked count from detecting cracked password lines if we found any
    // This ensures we show the correct count even when hashcat has finished
    if (crackedCount > 0) {
      session.cracked = crackedCount;
      // Calculate progress based on cracked count
      if (session.total > 0) {
        session.progress = (crackedCount / session.total) * 100;
      }
    }

    return session;
  }

  /**
   * Parse potfile content to extract cracked passwords
   */
  private parsePotfile(content: string): HashcatResult[] {
    const results: HashcatResult[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      if (line.trim() === '') continue;

      // Parse potfile line: hash:password:salt:hex_password
      // Handle different formats: hash:password:::hex or hash:password:salt:hex
      const parts = line.split(':');
      if (parts.length >= 2) {
        const result: HashcatResult = {
          hash: parts[0],
          plain: parts[1],
          timeCracked: new Date(), // Would need to be extracted from log files
        };

        // Extract salt if available (parts[2] and not empty)
        if (parts.length > 2 && parts[2] && parts[2].trim() !== '') {
          result.salt = parts[2];
        }

        // Extract hexPlain if available (parts[3] or parts[4] depending on format)
        if (parts.length > 3 && parts[3] && parts[3].trim() !== '') {
          result.hexPlain = parts[3];
        } else if (parts.length > 4 && parts[4] && parts[4].trim() !== '') {
          result.hexPlain = parts[4];
        }

        results.push(result);
      }
    }

    return results;
  }

  /**
   * Get active sessions list
   */
  getActiveSessions(): string[] {
    return Array.from(this.activeSessions.keys());
  }

  /**
   * Check if a session is still running
   */
  isSessionRunning(sessionName: string): boolean {
    const child = this.activeSessions.get(sessionName);
    return child ? !child.killed : false;
  }

  /**
   * Clean up completed sessions
   */
  cleanupSessions(): void {
    for (const [sessionName, child] of this.activeSessions.entries()) {
      if (child.killed) {
        this.activeSessions.delete(sessionName);
        this.sessionStatus.delete(sessionName);
        this.sessionOutputBuffer.delete(sessionName);
      }
    }
  }

  /**
   * Manually clear session cache
   */
  clearSessionCache(sessionName: string): void {
    this.sessionStatus.delete(sessionName);
    this.sessionOutputBuffer.delete(sessionName);
  }

  /**
   * Get cached status (synchronous, no promise)
   */
  getCachedStatus(sessionName: string): HashcatSession | null {
    return this.sessionStatus.get(sessionName) || null;
  }

  /**
   * Extract cracked passwords from session output buffer
   * Returns array of cracked WPA2 passwords with network information
   */
  getCrackedPasswords(sessionName: string): Array<{
    hash: string;
    bssid: string;
    apMac: string;
    essid: string;
    password: string;
  }> {
    const buffer = this.sessionOutputBuffer.get(sessionName);
    if (!buffer || buffer.length === 0) {
      return [];
    }

    const crackedPasswords: Array<{
      hash: string;
      bssid: string;
      apMac: string;
      essid: string;
      password: string;
    }> = [];

    // Track unique hashes to avoid duplicates
    const seenHashes = new Set<string>();

    for (const line of buffer) {
      // Match WPA2/WPA3 cracked password format (hash:bssid:ap_mac:essid:password)
      if (/^[a-f0-9]{32}:[a-f0-9]{12}:[a-f0-9]{12}:.+:.+$/i.test(line.trim())) {
        const parts = line.trim().split(':');
        if (parts.length >= 5) {
          const hash = parts[0];

          // Skip if we've already seen this hash
          if (seenHashes.has(hash)) {
            continue;
          }
          seenHashes.add(hash);

          const bssid = parts[1];
          const apMac = parts[2];
          const essid = parts[3];
          // Password is everything after the 4th colon (in case password contains colons)
          const password = parts.slice(4).join(':');

          crackedPasswords.push({
            hash,
            bssid,
            apMac,
            essid,
            password,
          });
        }
      }
    }

    return crackedPasswords;
  }
}

// Create a default instance
export const hashcat = new HashcatWrapper();
