import { existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

/**
 * Ensures all required directories for AutoPWN exist
 * Creates directories if they don't exist
 */
export function ensureDirectories(directories: string[]): void {
  console.log('[Init] Ensuring required directories exist...');

  for (const dir of directories) {
    try {
      // Ensure parent directory exists first
      const parentDir = dirname(dir);
      if (parentDir && parentDir !== dir && !existsSync(parentDir)) {
        mkdirSync(parentDir, { recursive: true });
        console.log(`[Init] Created parent directory: ${parentDir}`);
      }

      // Create the target directory
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
        console.log(`[Init] Created directory: ${dir}`);
      } else {
        console.log(`[Init] Directory exists: ${dir}`);
      }
    } catch (error) {
      console.error(`[Init] Failed to create directory ${dir}:`, error);
      throw error;
    }
  }

  console.log('[Init] Directory initialization complete');
}

/**
 * Get project root directory by navigating up from the current module
 */
function getProjectRoot(): string {
  // In CommonJS environment, use __dirname as fallback
  // @ts-ignore - __dirname may not be defined in ES modules
  const currentDir = dirname(__filename || process.cwd());
  // Go up from apps/backend/src to project root (apps/backend/src -> apps/backend -> apps -> project root)
  return dirname(dirname(dirname(currentDir)));
}

/**
 * Get all required directories for AutoPWN based on environment detection
 * Uses local development paths in development mode, Docker paths in production
 */
export function getRequiredDirectories(): string[] {
  // Detect if we're running in local development vs Docker production
  const isLocalDev = process.env.NODE_ENV === 'development' ||
                     (!process.env.DATABASE_PATH?.includes('/data/') &&
                      !process.env.PCAPS_PATH?.includes('/data/'));

  // Get absolute paths for local development
  const projectRoot = getProjectRoot();

  const paths = [
    // Database directory
    dirname(isLocalDev ? join(projectRoot, 'volumes/db/autopwn.db') : (process.env.DATABASE_PATH || '/data/db/autopwn.db')),

    // Application directories - determined by environment detection
    ...(isLocalDev ? [
      join(projectRoot, 'volumes/jobs'),
      join(projectRoot, 'volumes/dictionaries'),
      join(projectRoot, 'volumes/pcaps')
    ] : [
      process.env.JOBS_PATH || '/data/jobs',
      process.env.DICTIONARIES_PATH || '/data/dictionaries',
      process.env.PCAPS_PATH || '/data/pcaps',
    ]),
  ];

  // Remove duplicates and filter out empty strings
  const filteredPaths = paths.filter(path => path && path.trim() !== '');

  return [...new Set(filteredPaths)];
}