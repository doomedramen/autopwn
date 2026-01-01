import { vi } from "vitest";

// Mock child_process exec
export const mockExecInstance = vi.fn((command, callback) => {
  setTimeout(() => {
    callback(null, {
      stdout: "execution output",
      stderr: "",
    });
  }, 0);
  return { kill: vi.fn() } as any;
});

vi.mock("child_process", () => ({
  exec: mockExecInstance,
  spawn: vi.fn(),
}));

// Mock fs/promises
export const fsMock = {
  mkdir: vi.fn().mockResolvedValue(undefined),
  access: vi.fn((path) => {
    if (path.includes("nonexistent")) {
      return Promise.reject(new Error("File not found"));
    }
    return Promise.resolve(undefined);
  }),
  readFile: vi.fn().mockResolvedValue(Buffer.from("mock file content")),
  writeFile: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
  chmod: vi.fn().mockResolvedValue(undefined),
  readdir: vi.fn().mockResolvedValue([]),
  stat: vi.fn().mockResolvedValue({ size: 1024 }),
};

vi.mock("fs/promises", () => fsMock);

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
export const dbMock = {
  update: vi.fn().mockResolvedValue(undefined),
  insert: vi.fn().mockResolvedValue([{ id: "test-job-id" }]),
};

// Export mocks for use in tests
export {
  mockHashcatExecution,
  mockHcxToolExecution,
  mockOtherExecution,
};
