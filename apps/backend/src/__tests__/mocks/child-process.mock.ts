import { vi } from 'vitest';
import { EventEmitter } from 'events';

/**
 * Mock ChildProcess for testing worker service
 */
export class MockChildProcess extends EventEmitter {
  pid = 12345;
  killed = false;
  exitCode: number | null = null;
  stdout = new EventEmitter();
  stderr = new EventEmitter();

  kill(signal?: string) {
    this.killed = true;
    this.exitCode = signal === 'SIGKILL' ? 137 : 143;
    // Simulate process exit
    setImmediate(() => {
      this.emit('close', this.exitCode);
    });
    return true;
  }

  // Helper method to simulate stdout data
  emitStdout(data: string) {
    this.stdout.emit('data', Buffer.from(data));
  }

  // Helper method to simulate stderr data
  emitStderr(data: string) {
    this.stderr.emit('data', Buffer.from(data));
  }

  // Helper method to simulate process completion
  complete(code: number = 0) {
    this.exitCode = code;
    this.emit('close', code);
  }

  // Helper method to simulate process error
  error(err: Error) {
    this.emit('error', err);
  }
}

/**
 * Create mock spawn function
 */
export const createMockSpawn = () => {
  const mockProcess = new MockChildProcess();
  const spawnMock = vi.fn().mockReturnValue(mockProcess);
  return { spawnMock, mockProcess };
};

/**
 * Mock execAsync for testing
 */
export const createMockExecAsync = () => {
  return vi.fn().mockResolvedValue({
    stdout: 'mock output',
    stderr: '',
  });
};
