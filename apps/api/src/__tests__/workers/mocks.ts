import { vi } from "vitest";
import { execAsync } from "../lib/exec";

// Mock child_process
const mockExecInstance = vi.fn().mockImplementation((command, callback) => {
  setTimeout(() => {
    callback(null, {
      stdout: "execution output",
      stderr: "",
    });
  }, 0);
  return { kill: vi.fn() } as any;
});

vi.mock("child_process", () => ({
  exec: vi.fn(),
  spawn: vi.fn(),
}));

// Mock fs/promises
const fsMock = {
  mkdir: vi.fn().mockResolvedValue(undefined),
  access: vi.fn().mockImplementation((path) => {
    if (path.includes("nonexistent")) {
      return Promise.resolve(false);
    }
    return Promise.resolve(true);
  }),
  writeFile: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
  chmod: vi.fn().mockResolvedValue(undefined),
  readDir: vi.fn().mockResolvedValue([]),
};

vi.mock("fs/promises", () => ({
  promises: fsMock,
}));

// Mock hashcat execution
const mockHashcatExecution = vi.fn().mockImplementation((command, callback) => {
  setTimeout(() => {
    callback(null, {
      stdout: "hashcat execution output",
      stderr: "",
    });
  }, 100);
  return { kill: vi.fn() } as any;
});

// Mock hcx tools execution
const mockHcxToolExecution = vi.fn().mockImplementation((command, callback) => {
  setTimeout(() => {
    callback(null, {
      stdout: "hcxpcapngtool execution output",
      stderr: "",
    });
  }, 100);
  return { kill: vi.fn() } as any;
});

// Mock other tool execution
const mockOtherExecution = vi.fn().mockImplementation((command, callback) => {
  setTimeout(() => {
    callback(null, {
      stdout: "other tool output",
      stderr: "",
    });
  }, 100);
  return { kill: vi.fn() } as any;
});

// Mock database operations
const dbMock = {
  update: vi.fn().mockResolvedValue(undefined),
  insert: vi.fn().mockResolvedValue([{ id: "test-job-id" }]),
};

// Export mocks for use in tests
export {
  fsMock,
  dbMock,
  mockExecInstance,
  mockHashcatExecution,
  mockHcxToolExecution,
  mockOtherExecution
}

  await fsMock.unlink(commandFile);

  return {
    success: true,
    exitCode: execResult.code || 0,
    stdout: execResult.stdout,
    stderr: execResult.stderr,
    results: parseResult,
    jobId,
  };
}

// Helper function to simulate hcx tool execution
export async function mockHcxToolCommand(command: string) {
  const execResult = await execAsync({
    command: command.split(" "),
    env: {},
  });

  return {
    success: true,
    exitCode: execResult.code || 0,
    stdout: execResult.stdout,
    stderr: execResult.stderr,
    networks: [
      {
        bssid: "00:11:22:33:44:55",
        ssid: "TestNetwork",
        encryption: "WPA2",
      },
    ],
  };
}
