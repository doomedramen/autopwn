import { vi } from 'vitest';

/**
 * Mock database helper for testing
 * Provides common database operation mocks
 */
export const createMockDb = () => {
  const mockSelect = vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
        orderBy: vi.fn().mockResolvedValue([]),
      }),
      orderBy: vi.fn().mockResolvedValue([]),
      groupBy: vi.fn().mockResolvedValue([]),
    }),
  });

  const mockInsert = vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: 1 }]),
      onConflictDoNothing: vi.fn().mockResolvedValue([]),
    }),
  });

  const mockUpdate = vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    }),
  });

  const mockDelete = vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue([]),
  });

  return {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
  };
};

/**
 * Mock job data for testing
 */
export const createMockJob = (overrides: any = {}) => ({
  id: 1,
  jobId: 'test-job-123',
  userId: 'test-user-id',
  filename: 'test-capture.pcap',
  status: 'pending',
  priority: 5,
  paused: 0,
  batchMode: 0,
  itemsTotal: 10,
  itemsCracked: 0,
  createdAt: new Date(),
  startedAt: null,
  completedAt: null,
  currentDictionary: null,
  progress: 0,
  hashCount: 5,
  speed: null,
  eta: null,
  error: null,
  logs: null,
  captures: null,
  totalHashes: 5,
  ...overrides,
});

/**
 * Mock dictionary data for testing
 */
export const createMockDictionary = (overrides: any = {}) => ({
  id: 1,
  userId: 'test-user-id',
  name: 'test-dictionary.txt',
  path: '/tmp/test-dictionaries/test-dictionary.txt',
  size: 1024,
  ...overrides,
});

/**
 * Mock user data for testing
 */
export const createMockUser = (overrides: any = {}) => ({
  id: 'test-user-id',
  name: 'Test User',
  email: 'test@example.com',
  emailVerified: true,
  image: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

/**
 * Mock result data for testing
 */
export const createMockResult = (overrides: any = {}) => ({
  id: 1,
  jobId: 1,
  userId: 'test-user-id',
  essid: 'TestNetwork',
  password: 'password123',
  crackedAt: new Date(),
  pcapFilename: 'test-capture.pcap',
  ...overrides,
});

/**
 * Mock job item data for testing
 */
export const createMockJobItem = (overrides: any = {}) => ({
  id: 1,
  jobId: 1,
  userId: 'test-user-id',
  filename: 'test-capture.pcap',
  essid: 'TestNetwork',
  bssid: 'AA:BB:CC:DD:EE:FF',
  status: 'pending',
  password: null,
  crackedAt: null,
  pcapFilename: 'test-capture.pcap',
  ...overrides,
});
