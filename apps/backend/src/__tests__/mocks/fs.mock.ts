import { vi } from 'vitest';

/**
 * Mock filesystem operations for testing
 */
export const createMockFs = () => {
  const files = new Map<string, string>();
  const directories = new Set<string>();

  return {
    // Mock file operations
    readFile: vi.fn((path: string) => {
      const content = files.get(path);
      if (!content) {
        return Promise.reject(new Error(`ENOENT: no such file or directory, open '${path}'`));
      }
      return Promise.resolve(content);
    }),

    writeFile: vi.fn((path: string, data: string | Buffer) => {
      files.set(path, data.toString());
      return Promise.resolve();
    }),

    unlink: vi.fn((path: string) => {
      if (!files.has(path)) {
        return Promise.reject(new Error(`ENOENT: no such file or directory, unlink '${path}'`));
      }
      files.delete(path);
      return Promise.resolve();
    }),

    mkdir: vi.fn((path: string, options?: any) => {
      directories.add(path);
      return Promise.resolve();
    }),

    rm: vi.fn((path: string, options?: any) => {
      // Remove directory and all files in it
      for (const file of files.keys()) {
        if (file.startsWith(path)) {
          files.delete(file);
        }
      }
      directories.delete(path);
      return Promise.resolve();
    }),

    readdir: vi.fn((path: string, options?: any) => {
      const entries: any[] = [];
      for (const dir of directories) {
        if (dir.startsWith(path) && dir !== path) {
          const name = dir.substring(path.length + 1).split('/')[0];
          if (!entries.find(e => e.name === name)) {
            entries.push({
              name,
              isDirectory: () => true,
              isFile: () => false,
            });
          }
        }
      }
      for (const file of files.keys()) {
        if (file.startsWith(path) && file !== path) {
          const name = file.substring(path.length + 1).split('/')[0];
          if (!entries.find(e => e.name === name)) {
            entries.push({
              name,
              isDirectory: () => false,
              isFile: () => true,
            });
          }
        }
      }
      return Promise.resolve(entries);
    }),

    // Helper methods for test setup
    __setFile: (path: string, content: string) => {
      files.set(path, content);
    },

    __setDirectory: (path: string) => {
      directories.add(path);
    },

    __clear: () => {
      files.clear();
      directories.clear();
    },

    __getFiles: () => files,
    __getDirectories: () => directories,
  };
};
