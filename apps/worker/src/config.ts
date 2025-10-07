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
  pcapsPath: process.env.PCAPS_PATH || '/data/pcaps',
  jobsPath: process.env.JOBS_PATH || '/data/jobs',
  hashcatDeviceType: process.env.HASHCAT_DEVICE_TYPE || 'cpu',
};
