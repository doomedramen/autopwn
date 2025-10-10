import { describe, it, expect, beforeEach, vi } from 'vitest';
import { validateRequiredTools } from '../../../utils/validate-tools';
import { exec } from 'child_process';

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

describe('Tool Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset console spies
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('validateRequiredTools', () => {
    it('should pass when all tools are installed', async () => {
      const mockExec = vi.mocked(exec);

      // Mock hashcat version check
      mockExec.mockImplementationOnce((cmd, options, callback: any) => {
        callback(null, { stdout: 'hashcat v6.2.6', stderr: '' });
        return {} as any;
      });

      // Mock hcxpcapngtool version check
      mockExec.mockImplementationOnce((cmd, options, callback: any) => {
        callback(null, { stdout: 'hcxpcapngtool 6.3.0', stderr: '' });
        return {} as any;
      });

      await expect(validateRequiredTools()).resolves.not.toThrow();
      expect(console.log).toHaveBeenCalledWith('🔍 Validating required tools...');
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('✅ hashcat: v6.2.6'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('✅ hcxpcapngtool: v6.3.0'));
    });

    it('should throw error when hashcat is not installed', async () => {
      const mockExec = vi.mocked(exec);

      // Mock hashcat not found
      mockExec.mockImplementationOnce((cmd, options, callback: any) => {
        callback(new Error('hashcat: command not found'), { stdout: '', stderr: 'command not found' });
        return {} as any;
      });

      // Mock hcxpcapngtool found
      mockExec.mockImplementationOnce((cmd, options, callback: any) => {
        callback(null, { stdout: 'hcxpcapngtool 6.3.0', stderr: '' });
        return {} as any;
      });

      await expect(validateRequiredTools()).rejects.toThrow(/Missing required tools: hashcat/);
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('❌ hashcat: NOT FOUND'));
    });

    it('should throw error when hcxpcapngtool is not installed', async () => {
      const mockExec = vi.mocked(exec);

      // Mock hashcat found
      mockExec.mockImplementationOnce((cmd, options, callback: any) => {
        callback(null, { stdout: 'hashcat v6.2.6', stderr: '' });
        return {} as any;
      });

      // Mock hcxpcapngtool not found
      mockExec.mockImplementationOnce((cmd, options, callback: any) => {
        callback(new Error('hcxpcapngtool: command not found'), { stdout: '', stderr: 'command not found' });
        return {} as any;
      });

      await expect(validateRequiredTools()).rejects.toThrow(/Missing required tools: hcxpcapngtool/);
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('❌ hcxpcapngtool: NOT FOUND'));
    });

    it('should throw error when both tools are not installed', async () => {
      const mockExec = vi.mocked(exec);

      // Mock hashcat not found
      mockExec.mockImplementationOnce((cmd, options, callback: any) => {
        callback(new Error('hashcat: command not found'), { stdout: '', stderr: 'command not found' });
        return {} as any;
      });

      // Mock hcxpcapngtool not found
      mockExec.mockImplementationOnce((cmd, options, callback: any) => {
        callback(new Error('hcxpcapngtool: command not found'), { stdout: '', stderr: 'command not found' });
        return {} as any;
      });

      await expect(validateRequiredTools()).rejects.toThrow(/Missing required tools: hashcat, hcxpcapngtool/);
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('❌ hashcat: NOT FOUND'));
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('❌ hcxpcapngtool: NOT FOUND'));
    });

    it('should extract version numbers correctly', async () => {
      const mockExec = vi.mocked(exec);

      // Mock hashcat with different version format
      mockExec.mockImplementationOnce((cmd, options, callback: any) => {
        callback(null, { stdout: 'hashcat (v6.2.6) starting...', stderr: '' });
        return {} as any;
      });

      // Mock hcxpcapngtool with different version format
      mockExec.mockImplementationOnce((cmd, options, callback: any) => {
        callback(null, { stdout: 'hcxpcapngtool version 6.3.0 released', stderr: '' });
        return {} as any;
      });

      await validateRequiredTools();
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('✅ hashcat: v6.2.6'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('✅ hcxpcapngtool: v6.3.0'));
    });

    it('should handle tools that output version to stderr', async () => {
      const mockExec = vi.mocked(exec);

      // Mock hashcat outputting to stderr
      mockExec.mockImplementationOnce((cmd, options, callback: any) => {
        callback(null, { stdout: '', stderr: 'hashcat v6.2.6' });
        return {} as any;
      });

      // Mock hcxpcapngtool normal
      mockExec.mockImplementationOnce((cmd, options, callback: any) => {
        callback(null, { stdout: 'hcxpcapngtool 6.3.0', stderr: '' });
        return {} as any;
      });

      await validateRequiredTools();
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('✅ hashcat: v6.2.6'));
    });

    it('should handle timeout gracefully', async () => {
      const mockExec = vi.mocked(exec);

      // Mock timeout
      mockExec.mockImplementationOnce((cmd, options, callback: any) => {
        setTimeout(() => {
          callback(new Error('Command timeout'), { stdout: '', stderr: '' });
        }, 100);
        return {} as any;
      });

      mockExec.mockImplementationOnce((cmd, options, callback: any) => {
        callback(null, { stdout: 'hcxpcapngtool 6.3.0', stderr: '' });
        return {} as any;
      });

      await expect(validateRequiredTools()).rejects.toThrow(/Missing required tools/);
    });

    it('should provide installation instructions in error message', async () => {
      const mockExec = vi.mocked(exec);

      // Mock both tools not found
      mockExec.mockImplementation((cmd, options, callback: any) => {
        callback(new Error('command not found'), { stdout: '', stderr: 'command not found' });
        return {} as any;
      });

      try {
        await validateRequiredTools();
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).toContain('Installation instructions');
        expect(error.message).toContain('hashcat.net');
        expect(error.message).toContain('hcxtools');
      }
    });
  });
});
