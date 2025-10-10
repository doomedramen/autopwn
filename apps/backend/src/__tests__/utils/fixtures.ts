/**
 * Test fixtures and seed data helpers
 * Provides realistic test data for comprehensive testing
 */

export const testUsers = {
  admin: {
    id: 'user-admin-123',
    name: 'Admin User',
    email: 'admin@autopwn.test',
    emailVerified: true,
    image: null,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  },
  regular: {
    id: 'user-regular-456',
    name: 'Regular User',
    email: 'user@autopwn.test',
    emailVerified: true,
    image: null,
    createdAt: new Date('2024-01-15T00:00:00Z'),
    updatedAt: new Date('2024-01-15T00:00:00Z'),
  },
  unverified: {
    id: 'user-unverified-789',
    name: 'Unverified User',
    email: 'unverified@autopwn.test',
    emailVerified: false,
    image: null,
    createdAt: new Date('2024-02-01T00:00:00Z'),
    updatedAt: new Date('2024-02-01T00:00:00Z'),
  },
};

export const testDictionaries = {
  rockyou: {
    id: 1,
    userId: testUsers.admin.id,
    name: 'rockyou.txt',
    path: '/tmp/test-dictionaries/user-admin-123/rockyou.txt',
    size: 133851921, // Actual rockyou.txt size
  },
  common: {
    id: 2,
    userId: testUsers.admin.id,
    name: 'common-passwords.txt',
    path: '/tmp/test-dictionaries/user-admin-123/common-passwords.txt',
    size: 10240,
  },
  custom: {
    id: 3,
    userId: testUsers.regular.id,
    name: 'custom-wordlist.txt',
    path: '/tmp/test-dictionaries/user-regular-456/custom-wordlist.txt',
    size: 5120,
  },
  large: {
    id: 4,
    userId: testUsers.admin.id,
    name: 'large-wordlist.gz',
    path: '/tmp/test-dictionaries/user-admin-123/large-wordlist.gz',
    size: 524288000, // 500MB compressed
  },
};

export const testJobs = {
  pending: {
    id: 1,
    jobId: 'job-pending-001',
    userId: testUsers.admin.id,
    filename: 'capture-wifi-home.pcap',
    status: 'pending',
    priority: 5,
    paused: 0,
    batchMode: 0,
    itemsTotal: 10,
    itemsCracked: 0,
    createdAt: new Date('2024-03-01T10:00:00Z'),
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
  },
  processing: {
    id: 2,
    jobId: 'job-processing-002',
    userId: testUsers.admin.id,
    filename: 'capture-office.pcap',
    status: 'processing',
    priority: 8,
    paused: 0,
    batchMode: 0,
    itemsTotal: 15,
    itemsCracked: 5,
    createdAt: new Date('2024-03-01T11:00:00Z'),
    startedAt: new Date('2024-03-01T11:05:00Z'),
    completedAt: null,
    currentDictionary: 'rockyou.txt',
    progress: 33,
    hashCount: 8,
    speed: '1250.5 kH/s',
    eta: '00:15:30',
    error: null,
    logs: 'Processing with hashcat...',
    captures: null,
    totalHashes: 8,
  },
  completed: {
    id: 3,
    jobId: 'job-completed-003',
    userId: testUsers.regular.id,
    filename: 'capture-cafe.pcap',
    status: 'completed',
    priority: 5,
    paused: 0,
    batchMode: 0,
    itemsTotal: 8,
    itemsCracked: 8,
    createdAt: new Date('2024-03-01T09:00:00Z'),
    startedAt: new Date('2024-03-01T09:05:00Z'),
    completedAt: new Date('2024-03-01T09:45:00Z'),
    currentDictionary: 'common-passwords.txt',
    progress: 100,
    hashCount: 8,
    speed: null,
    eta: null,
    error: null,
    logs: 'Job completed successfully',
    captures: null,
    totalHashes: 8,
  },
  failed: {
    id: 4,
    jobId: 'job-failed-004',
    userId: testUsers.regular.id,
    filename: 'invalid-capture.pcap',
    status: 'failed',
    priority: 3,
    paused: 0,
    batchMode: 0,
    itemsTotal: 0,
    itemsCracked: 0,
    createdAt: new Date('2024-03-01T12:00:00Z'),
    startedAt: new Date('2024-03-01T12:05:00Z'),
    completedAt: new Date('2024-03-01T12:06:00Z'),
    currentDictionary: null,
    progress: 0,
    hashCount: 0,
    speed: null,
    eta: null,
    error: 'No ESSIDs found in PCAP file',
    logs: null,
    captures: null,
    totalHashes: 0,
  },
  paused: {
    id: 5,
    jobId: 'job-paused-005',
    userId: testUsers.admin.id,
    filename: 'capture-library.pcap',
    status: 'paused',
    priority: 7,
    paused: 1,
    batchMode: 0,
    itemsTotal: 12,
    itemsCracked: 3,
    createdAt: new Date('2024-03-01T13:00:00Z'),
    startedAt: new Date('2024-03-01T13:05:00Z'),
    completedAt: null,
    currentDictionary: 'rockyou.txt',
    progress: 25,
    hashCount: 6,
    speed: null,
    eta: null,
    error: null,
    logs: 'Job paused by user',
    captures: null,
    totalHashes: 6,
  },
};

export const testResults = {
  homeWifi: {
    id: 1,
    jobId: 3,
    userId: testUsers.regular.id,
    essid: 'HomeWiFi_2.4G',
    password: 'MySecurePassword123',
    crackedAt: new Date('2024-03-01T09:30:00Z'),
    pcapFilename: 'capture-cafe.pcap',
  },
  coffeeShop: {
    id: 2,
    jobId: 3,
    userId: testUsers.regular.id,
    essid: 'CoffeeShop_Guest',
    password: 'password123',
    crackedAt: new Date('2024-03-01T09:25:00Z'),
    pcapFilename: 'capture-cafe.pcap',
  },
  office: {
    id: 3,
    jobId: 2,
    userId: testUsers.admin.id,
    essid: 'Office_Corporate',
    password: 'OfficeWiFi2024!',
    crackedAt: new Date('2024-03-01T11:20:00Z'),
    pcapFilename: 'capture-office.pcap',
  },
};

export const testJobItems = {
  homeNetwork: {
    id: 1,
    jobId: 3,
    userId: testUsers.regular.id,
    filename: 'capture-cafe.pcap',
    essid: 'HomeWiFi_2.4G',
    bssid: 'AA:BB:CC:DD:EE:01',
    status: 'completed',
    password: 'MySecurePassword123',
    crackedAt: new Date('2024-03-01T09:30:00Z'),
    pcapFilename: 'capture-cafe.pcap',
  },
  officeNetwork: {
    id: 2,
    jobId: 2,
    userId: testUsers.admin.id,
    filename: 'capture-office.pcap',
    essid: 'Office_Corporate',
    bssid: 'AA:BB:CC:DD:EE:02',
    status: 'completed',
    password: 'OfficeWiFi2024!',
    crackedAt: new Date('2024-03-01T11:20:00Z'),
    pcapFilename: 'capture-office.pcap',
  },
  pendingItem: {
    id: 3,
    jobId: 1,
    userId: testUsers.admin.id,
    filename: 'capture-wifi-home.pcap',
    essid: 'UnknownNetwork',
    bssid: 'AA:BB:CC:DD:EE:03',
    status: 'pending',
    password: null,
    crackedAt: null,
    pcapFilename: 'capture-wifi-home.pcap',
  },
};

export const testPcapEssidMappings = [
  {
    id: 1,
    userId: testUsers.admin.id,
    pcapFilename: 'capture-wifi-home.pcap',
    essid: 'HomeWiFi_2.4G',
    bssid: 'AA:BB:CC:DD:EE:01',
    createdAt: new Date('2024-03-01T10:00:00Z'),
  },
  {
    id: 2,
    userId: testUsers.admin.id,
    pcapFilename: 'capture-wifi-home.pcap',
    essid: 'HomeWiFi_5G',
    bssid: 'AA:BB:CC:DD:EE:04',
    createdAt: new Date('2024-03-01T10:00:00Z'),
  },
  {
    id: 3,
    userId: testUsers.regular.id,
    pcapFilename: 'capture-cafe.pcap',
    essid: 'CoffeeShop_Guest',
    bssid: 'BB:CC:DD:EE:FF:01',
    createdAt: new Date('2024-03-01T09:00:00Z'),
  },
];

/**
 * Generate realistic chunked upload metadata
 */
export function createChunkedUploadMetadata(overrides: any = {}) {
  return {
    filename: 'large-dictionary.txt',
    userId: testUsers.admin.id,
    totalChunks: 10,
    fileSize: 10485760, // 10MB
    createdAt: Date.now(),
    receivedChunks: [],
    ...overrides,
  };
}

/**
 * Generate test PCAP file data
 */
export function createTestPcapData() {
  return {
    essids: ['TestNetwork1', 'TestNetwork2', 'TestNetwork3'],
    bssids: ['AA:BB:CC:DD:EE:01', 'AA:BB:CC:DD:EE:02', 'AA:BB:CC:DD:EE:03'],
    handshakes: 3,
  };
}

/**
 * Generate password list for testing
 */
export function createPasswordList(count: number): string[] {
  const passwords = [];
  for (let i = 0; i < count; i++) {
    passwords.push(`password${i + 1}`);
  }
  return passwords;
}

/**
 * Create test buffer with specific size
 */
export function createTestBuffer(sizeInBytes: number): Buffer {
  return Buffer.alloc(sizeInBytes, 'a');
}

/**
 * Generate realistic job statistics
 */
export function createJobStatistics() {
  return {
    totalJobs: 150,
    pendingJobs: 25,
    processingJobs: 10,
    completedJobs: 100,
    failedJobs: 15,
    totalPasswordsCracked: 1250,
    averageTimePerJob: 1800, // 30 minutes in seconds
    successRate: 67, // percentage
  };
}

/**
 * Generate dictionary usage statistics
 */
export function createDictionaryStats() {
  return {
    totalDictionaries: 20,
    totalSize: 2147483648, // 2GB
    mostUsedDictionary: testDictionaries.rockyou,
    averageSuccessRate: 72,
    totalJobsRun: 500,
  };
}
