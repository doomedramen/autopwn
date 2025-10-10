import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { UploadService } from '../../../services/upload';

// Mock execAsync function - must use vi.hoisted for mocks
const { mockExecAsync } = vi.hoisted(() => {
  return {
    mockExecAsync: vi.fn(),
  };
});

// Mock dependencies
vi.mock('child_process');

vi.mock('util', () => ({
  promisify: () => mockExecAsync,
}));

// Mock fs module using hoisted mocks
const { mockReadFileSync, mockUnlinkSync } = vi.hoisted(() => ({
  mockReadFileSync: vi.fn(),
  mockUnlinkSync: vi.fn(),
}));

// Mock both 'fs' and 'node:fs' to cover both import styles
vi.mock('fs', () => ({
  default: {
    readFileSync: mockReadFileSync,
    unlinkSync: mockUnlinkSync,
  },
  readFileSync: mockReadFileSync,
  unlinkSync: mockUnlinkSync,
}));

vi.mock('node:fs', () => ({
  default: {
    readFileSync: mockReadFileSync,
    unlinkSync: mockUnlinkSync,
  },
  readFileSync: mockReadFileSync,
  unlinkSync: mockUnlinkSync,
}));

vi.mock('../../../db', () => ({
  db: {
    insert: vi.fn(),
  },
  pcapEssidMapping: {},
}));

vi.mock('../../../config/env.js', () => ({
  env: {
    PCAPS_PATH: '/tmp/test-pcaps',
  },
}));

describe('UploadService - ESSID Extraction', () => {
  let uploadService: UploadService;
  let mockDb: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockDb = await import('../../../db');

    uploadService = new UploadService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('extractEssids - Successful Extraction', () => {
    it('should extract single ESSID and BSSID from PCAP file', async () => {
      const pcapPath = '/tmp/test-pcaps/user-123/capture.pcap';
      const filename = 'capture.pcap';
      const userId = 'user-123';

      // Mock hcxpcapngtool execution (Promise-based)
      mockExecAsync.mockResolvedValueOnce({
        stdout: 'Successfully extracted handshakes',
        stderr: ''
      });

      // Mock ESSID file content
      const essidContent = 'aa:bb:cc:dd:ee:ff HomeWiFi';
      mockReadFileSync.mockReturnValue(essidContent);

      // Mock database insert
      const mockInsertResult = {
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockResolvedValue({}),
        }),
      };
      vi.mocked(mockDb.db.insert).mockReturnValue(mockInsertResult);

      // Call private method via any cast
      await (uploadService as any).extractEssids(pcapPath, filename, userId);

      // Verify hcxpcapngtool was called
      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining('hcxpcapngtool'),
        expect.objectContaining({ timeout: 30000 })
      );

      // Verify ESSID file was read
      expect(mockReadFileSync).toHaveBeenCalledWith(
        `/tmp/${filename}.essids`,
        'utf8'
      );

      // Verify database insert was called
      expect(mockDb.db.insert).toHaveBeenCalledWith(mockDb.pcapEssidMapping);
      expect(mockInsertResult.values).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          pcapFilename: filename,
          essid: 'HomeWiFi',
          bssid: 'aa:bb:cc:dd:ee:ff',
        })
      );
    });

    it('should extract multiple ESSIDs from PCAP file', async () => {
      const pcapPath = '/tmp/test-pcaps/user-123/multi.pcap';
      const filename = 'multi.pcap';
      const userId = 'user-123';

      mockExecAsync.mockResolvedValueOnce({
        stdout: 'Extracted 3 networks',
        stderr: ''
      });

      // Multiple ESSIDs in output
      const essidContent = `aa:bb:cc:dd:ee:01 Network1
aa:bb:cc:dd:ee:02 Network2
aa:bb:cc:dd:ee:03 Network3`;
      mockReadFileSync.mockReturnValue(essidContent);

      const mockInsertResult = {
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockResolvedValue({}),
        }),
      };
      vi.mocked(mockDb.db.insert).mockReturnValue(mockInsertResult);

      await (uploadService as any).extractEssids(pcapPath, filename, userId);

      // Verify 3 database inserts
      expect(mockInsertResult.values).toHaveBeenCalledTimes(3);
      expect(mockInsertResult.values).toHaveBeenCalledWith(
        expect.objectContaining({ essid: 'Network1', bssid: 'aa:bb:cc:dd:ee:01' })
      );
      expect(mockInsertResult.values).toHaveBeenCalledWith(
        expect.objectContaining({ essid: 'Network2', bssid: 'aa:bb:cc:dd:ee:02' })
      );
      expect(mockInsertResult.values).toHaveBeenCalledWith(
        expect.objectContaining({ essid: 'Network3', bssid: 'aa:bb:cc:dd:ee:03' })
      );
    });

    it('should handle ESSID with spaces in name', async () => {
      const pcapPath = '/tmp/test-pcaps/user-123/spaces.pcap';
      const filename = 'spaces.pcap';
      const userId = 'user-123';

      mockExecAsync.mockResolvedValueOnce({
        stdout: 'Success',
        stderr: ''
      });

      const essidContent = 'aa:bb:cc:dd:ee:ff My Home Network 2.4GHz';
      mockReadFileSync.mockReturnValue(essidContent);

      const mockInsertResult = {
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockResolvedValue({}),
        }),
      };
      vi.mocked(mockDb.db.insert).mockReturnValue(mockInsertResult);

      await (uploadService as any).extractEssids(pcapPath, filename, userId);

      expect(mockInsertResult.values).toHaveBeenCalledWith(
        expect.objectContaining({
          essid: 'My Home Network 2.4GHz',
        })
      );
    });

    it('should deduplicate identical ESSIDs', async () => {
      const pcapPath = '/tmp/test-pcaps/user-123/dupe.pcap';
      const filename = 'dupe.pcap';
      const userId = 'user-123';

      mockExecAsync.mockResolvedValueOnce({
        stdout: 'Success',
        stderr: ''
      });

      // Same ESSID appears multiple times
      const essidContent = `aa:bb:cc:dd:ee:01 HomeWiFi
aa:bb:cc:dd:ee:02 HomeWiFi
aa:bb:cc:dd:ee:03 HomeWiFi`;
      mockReadFileSync.mockReturnValue(essidContent);

      const mockInsertResult = {
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockResolvedValue({}),
        }),
      };
      vi.mocked(mockDb.db.insert).mockReturnValue(mockInsertResult);

      await (uploadService as any).extractEssids(pcapPath, filename, userId);

      // Should only insert once (deduplication)
      expect(mockInsertResult.values).toHaveBeenCalledTimes(1);
      expect(mockInsertResult.values).toHaveBeenCalledWith(
        expect.objectContaining({
          essid: 'HomeWiFi',
          bssid: 'aa:bb:cc:dd:ee:01',
        })
      );
    });
  });

  describe('extractEssids - Error Handling', () => {
    it('should handle hcxpcapngtool command failure', async () => {
      const pcapPath = '/tmp/test-pcaps/user-123/broken.pcap';
      const filename = 'broken.pcap';
      const userId = 'user-123';

      // Mock command failure
      mockExecAsync.mockRejectedValueOnce(new Error('hcxpcapngtool failed'));

      // Should not throw - error is caught and logged
      await expect(
        (uploadService as any).extractEssids(pcapPath, filename, userId)
      ).resolves.not.toThrow();

      // Should not attempt to read ESSID file
      expect(mockReadFileSync).not.toHaveBeenCalled();
    });

    it('should handle missing ESSID output file', async () => {
      const pcapPath = '/tmp/test-pcaps/user-123/no-essids.pcap';
      const filename = 'no-essids.pcap';
      const userId = 'user-123';

      mockExecAsync.mockResolvedValueOnce({
        stdout: 'No handshakes found',
        stderr: ''
      });

      // Mock file not found
      mockReadFileSync.mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });

      // Should not throw - continues without ESSIDs
      await expect(
        (uploadService as any).extractEssids(pcapPath, filename, userId)
      ).resolves.not.toThrow();

      // Should not attempt database insert
      expect(mockDb.db.insert).not.toHaveBeenCalled();
    });

    it('should handle hcxpcapngtool timeout', async () => {
      const pcapPath = '/tmp/test-pcaps/user-123/large.pcap';
      const filename = 'large.pcap';
      const userId = 'user-123';

      // Mock timeout error
      const timeoutError = new Error('Command timed out after 30000ms');
      (timeoutError as any).killed = true;
      (timeoutError as any).signal = 'SIGTERM';
      mockExecAsync.mockRejectedValueOnce(timeoutError);

      await expect(
        (uploadService as any).extractEssids(pcapPath, filename, userId)
      ).resolves.not.toThrow();
    });

    it('should handle empty ESSID output file', async () => {
      const pcapPath = '/tmp/test-pcaps/user-123/empty.pcap';
      const filename = 'empty.pcap';
      const userId = 'user-123';

      mockExecAsync.mockResolvedValueOnce({
        stdout: 'Processed',
        stderr: ''
      });

      // Empty file content
      mockReadFileSync.mockReturnValue('');

      await (uploadService as any).extractEssids(pcapPath, filename, userId);

      // Should not attempt database insert
      expect(mockDb.db.insert).not.toHaveBeenCalled();
    });

    it('should handle malformed ESSID output', async () => {
      const pcapPath = '/tmp/test-pcaps/user-123/malformed.pcap';
      const filename = 'malformed.pcap';
      const userId = 'user-123';

      mockExecAsync.mockResolvedValueOnce({
        stdout: 'Success',
        stderr: ''
      });

      // Malformed output (no BSSID:ESSID pattern)
      const essidContent = `invalid line format
another bad line
not matching pattern`;
      mockReadFileSync.mockReturnValue(essidContent);

      await (uploadService as any).extractEssids(pcapPath, filename, userId);

      // Should not attempt database insert for malformed lines
      expect(mockDb.db.insert).not.toHaveBeenCalled();
    });

    it('should handle database insertion failure gracefully', async () => {
      const pcapPath = '/tmp/test-pcaps/user-123/db-fail.pcap';
      const filename = 'db-fail.pcap';
      const userId = 'user-123';

      mockExecAsync.mockResolvedValueOnce({
        stdout: 'Success',
        stderr: ''
      });

      const essidContent = 'aa:bb:cc:dd:ee:ff TestNetwork';
      mockReadFileSync.mockReturnValue(essidContent);

      // Mock database insertion failure
      const mockInsertResult = {
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockRejectedValue(new Error('Database error')),
        }),
      };
      vi.mocked(mockDb.db.insert).mockReturnValue(mockInsertResult);

      // Should not throw - database errors are caught and logged
      await expect(
        (uploadService as any).extractEssids(pcapPath, filename, userId)
      ).resolves.not.toThrow();
    });
  });

  describe('extractEssids - Cleanup', () => {
    it('should clean up temporary files after successful extraction', async () => {
      const pcapPath = '/tmp/test-pcaps/user-123/cleanup.pcap';
      const filename = 'cleanup.pcap';
      const userId = 'user-123';

      mockExecAsync.mockResolvedValueOnce({
        stdout: 'Success',
        stderr: ''
      });

      const essidContent = 'aa:bb:cc:dd:ee:ff TestNetwork';
      mockReadFileSync.mockReturnValue(essidContent);

      const mockInsertResult = {
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockResolvedValue({}),
        }),
      };
      vi.mocked(mockDb.db.insert).mockReturnValue(mockInsertResult);

      await (uploadService as any).extractEssids(pcapPath, filename, userId);

      // Verify cleanup attempts
      expect(mockUnlinkSync).toHaveBeenCalledWith(`/tmp/${filename}.hc22000`);
      expect(mockUnlinkSync).toHaveBeenCalledWith(`/tmp/${filename}.essids`);
    });

    it('should continue if cleanup fails', async () => {
      const pcapPath = '/tmp/test-pcaps/user-123/cleanup-fail.pcap';
      const filename = 'cleanup-fail.pcap';
      const userId = 'user-123';

      mockExecAsync.mockResolvedValueOnce({
        stdout: 'Success',
        stderr: ''
      });

      const essidContent = 'aa:bb:cc:dd:ee:ff TestNetwork';
      mockReadFileSync.mockReturnValue(essidContent);

      const mockInsertResult = {
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockResolvedValue({}),
        }),
      };
      vi.mocked(mockDb.db.insert).mockReturnValue(mockInsertResult);

      // Mock cleanup failure
      mockUnlinkSync.mockImplementation(() => {
        throw new Error('Failed to delete file');
      });

      // Should not throw even if cleanup fails
      await expect(
        (uploadService as any).extractEssids(pcapPath, filename, userId)
      ).resolves.not.toThrow();
    });
  });

  describe('extractEssids - BSSID Handling', () => {
    it('should store ESSID without BSSID if not available', async () => {
      const pcapPath = '/tmp/test-pcaps/user-123/no-bssid.pcap';
      const filename = 'no-bssid.pcap';
      const userId = 'user-123';

      mockExecAsync.mockResolvedValueOnce({
        stdout: 'Success',
        stderr: ''
      });

      // Only ESSID, no proper BSSID format
      const essidContent = 'NetworkWithoutBSSID';
      mockReadFileSync.mockReturnValue(essidContent);

      await (uploadService as any).extractEssids(pcapPath, filename, userId);

      // Should not insert if no valid BSSID:ESSID pattern
      expect(mockDb.db.insert).not.toHaveBeenCalled();
    });

    it('should handle BSSID-only lines without ESSID', async () => {
      const pcapPath = '/tmp/test-pcaps/user-123/bssid-only.pcap';
      const filename = 'bssid-only.pcap';
      const userId = 'user-123';

      mockExecAsync.mockResolvedValueOnce({
        stdout: 'Success',
        stderr: ''
      });

      // BSSID without ESSID (empty ESSID)
      const essidContent = 'aa:bb:cc:dd:ee:ff ';
      mockReadFileSync.mockReturnValue(essidContent);

      await (uploadService as any).extractEssids(pcapPath, filename, userId);

      // Should not insert empty ESSID
      expect(mockDb.db.insert).not.toHaveBeenCalled();
    });

    it('should deduplicate BSSIDs', async () => {
      const pcapPath = '/tmp/test-pcaps/user-123/dupe-bssid.pcap';
      const filename = 'dupe-bssid.pcap';
      const userId = 'user-123';

      mockExecAsync.mockResolvedValueOnce({
        stdout: 'Success',
        stderr: ''
      });

      // Same BSSID with different ESSIDs (band steering)
      const essidContent = `aa:bb:cc:dd:ee:01 Network_2.4G
aa:bb:cc:dd:ee:01 Network_5G`;
      mockReadFileSync.mockReturnValue(essidContent);

      const mockInsertResult = {
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockResolvedValue({}),
        }),
      };
      vi.mocked(mockDb.db.insert).mockReturnValue(mockInsertResult);

      await (uploadService as any).extractEssids(pcapPath, filename, userId);

      // Should insert both (different ESSIDs)
      expect(mockInsertResult.values).toHaveBeenCalledTimes(2);
    });
  });

  describe('extractEssids - Edge Cases', () => {
    it('should handle lines with only whitespace', async () => {
      const pcapPath = '/tmp/test-pcaps/user-123/whitespace.pcap';
      const filename = 'whitespace.pcap';
      const userId = 'user-123';

      mockExecAsync.mockResolvedValueOnce({
        stdout: 'Success',
        stderr: ''
      });

      const essidContent = `

aa:bb:cc:dd:ee:ff ValidNetwork

`;
      mockReadFileSync.mockReturnValue(essidContent);

      const mockInsertResult = {
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockResolvedValue({}),
        }),
      };
      vi.mocked(mockDb.db.insert).mockReturnValue(mockInsertResult);

      await (uploadService as any).extractEssids(pcapPath, filename, userId);

      // Should only insert the valid line
      expect(mockInsertResult.values).toHaveBeenCalledTimes(1);
      expect(mockInsertResult.values).toHaveBeenCalledWith(
        expect.objectContaining({ essid: 'ValidNetwork' })
      );
    });

    it('should handle special characters in ESSID', async () => {
      const pcapPath = '/tmp/test-pcaps/user-123/special-chars.pcap';
      const filename = 'special-chars.pcap';
      const userId = 'user-123';

      mockExecAsync.mockResolvedValueOnce({
        stdout: 'Success',
        stderr: ''
      });

      // ESSID with special characters
      const essidContent = 'aa:bb:cc:dd:ee:ff WiFi@Home_2024!#$';
      mockReadFileSync.mockReturnValue(essidContent);

      const mockInsertResult = {
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockResolvedValue({}),
        }),
      };
      vi.mocked(mockDb.db.insert).mockReturnValue(mockInsertResult);

      await (uploadService as any).extractEssids(pcapPath, filename, userId);

      expect(mockInsertResult.values).toHaveBeenCalledWith(
        expect.objectContaining({
          essid: 'WiFi@Home_2024!#$',
        })
      );
    });

    it('should handle very long ESSID names', async () => {
      const pcapPath = '/tmp/test-pcaps/user-123/long-essid.pcap';
      const filename = 'long-essid.pcap';
      const userId = 'user-123';

      mockExecAsync.mockResolvedValueOnce({
        stdout: 'Success',
        stderr: ''
      });

      // ESSID at max length (32 characters)
      const longEssid = 'A'.repeat(32);
      const essidContent = `aa:bb:cc:dd:ee:ff ${longEssid}`;
      mockReadFileSync.mockReturnValue(essidContent);

      const mockInsertResult = {
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockResolvedValue({}),
        }),
      };
      vi.mocked(mockDb.db.insert).mockReturnValue(mockInsertResult);

      await (uploadService as any).extractEssids(pcapPath, filename, userId);

      expect(mockInsertResult.values).toHaveBeenCalledWith(
        expect.objectContaining({
          essid: longEssid,
        })
      );
    });
  });
});
