export const DB_SCHEMA = `
CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT,
  filename TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  priority INTEGER NOT NULL DEFAULT 0,
  paused INTEGER NOT NULL DEFAULT 0,
  batch_mode INTEGER NOT NULL DEFAULT 0,
  items_total INTEGER,
  items_cracked INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at TEXT,
  completed_at TEXT,
  current_dictionary TEXT,
  progress REAL,
  hash_count INTEGER,
  speed TEXT,
  eta TEXT,
  error TEXT,
  logs TEXT,
  captures TEXT,
  total_hashes INTEGER
);

CREATE TABLE IF NOT EXISTS job_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL,
  filename TEXT NOT NULL,
  essid TEXT,
  bssid TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  password TEXT,
  cracked_at TEXT,
  pcap_filename TEXT,
  FOREIGN KEY (job_id) REFERENCES jobs(id)
);

CREATE TABLE IF NOT EXISTS job_dictionaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL,
  dictionary_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  FOREIGN KEY (job_id) REFERENCES jobs(id),
  FOREIGN KEY (dictionary_id) REFERENCES dictionaries(id),
  UNIQUE(job_id, dictionary_id)
);

CREATE TABLE IF NOT EXISTS results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL,
  essid TEXT NOT NULL,
  password TEXT NOT NULL,
  cracked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  pcap_filename TEXT,
  FOREIGN KEY (job_id) REFERENCES jobs(id)
);

CREATE TABLE IF NOT EXISTS dictionaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  path TEXT NOT NULL,
  size INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS pcap_essid_mapping (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pcap_filename TEXT NOT NULL,
  essid TEXT NOT NULL,
  bssid TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(pcap_filename, essid)
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_priority ON jobs(priority DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_job_items_job_id ON job_items(job_id);
CREATE INDEX IF NOT EXISTS idx_job_dictionaries_job_id ON job_dictionaries(job_id);
CREATE INDEX IF NOT EXISTS idx_results_job_id ON results(job_id);
CREATE INDEX IF NOT EXISTS idx_pcap_essid_pcap_filename ON pcap_essid_mapping(pcap_filename);
CREATE INDEX IF NOT EXISTS idx_pcap_essid_essid ON pcap_essid_mapping(essid);
`;
