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
};
