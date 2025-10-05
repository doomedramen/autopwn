import dotenv from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root
dotenv.config({ path: resolve(__dirname, '../../../.env') });

export const config = {
  databasePath: process.env.DATABASE_PATH || '/data/db/autopwn.db',
  dictionariesPath: process.env.DICTIONARIES_PATH || '/data/dictionaries',
  inputPath: process.env.INPUT_PATH || '/data/input',
  intermediatePath: process.env.INTERMEDIATE_PATH || '/data/intermediate',
  completedPath: process.env.COMPLETED_PATH || '/data/completed',
  failedPath: process.env.FAILED_PATH || '/data/failed',
  hashesPath: process.env.HASHES_PATH || '/data/hashes',
  hashcatDeviceType: process.env.HASHCAT_DEVICE_TYPE || 'cpu',

  // Batch processing configuration
  batchModeEnabled: process.env.BATCH_MODE_ENABLED === 'true',
  batchQuietPeriod: parseInt(process.env.BATCH_QUIET_PERIOD || '60') * 1000, // Convert to ms
  batchMaxWait: parseInt(process.env.BATCH_MAX_WAIT || '300') * 1000, // Convert to ms
  batchMinFiles: parseInt(process.env.BATCH_MIN_FILES || '1'),
  batchMaxFiles: parseInt(process.env.BATCH_MAX_FILES || '50'),
};
