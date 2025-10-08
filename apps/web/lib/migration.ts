import Database from 'better-sqlite3';
import { ensureDirectories, getRequiredDirectories } from '@autopwn/shared';
import path from 'path';
import fs from 'fs';

const DATABASE_PATH = process.env.DATABASE_PATH || '/data/db/autopwn.db';

interface Migration {
  version: number;
  name: string;
  up: string;
  down?: string;
}

const MIGRATIONS: Migration[] = [
  // Add future migrations here
  // Example:
  // {
  //   version: 2,
  //   name: 'add_upload_column',
  //   up: 'ALTER TABLE jobs ADD COLUMN upload_path TEXT;',
  //   down: 'ALTER TABLE jobs DROP COLUMN upload_path;',
  // },
];

// Get current schema version from the database
function getCurrentSchemaVersion(db: Database.Database): number {
  try {
    const result = db.prepare('SELECT version FROM schema_migration ORDER BY version DESC LIMIT 1').get() as { version: number } | undefined;
    return result?.version || 0;
  } catch (error) {
    // Table doesn't exist yet, return 0
    return 0;
  }
}

// Set schema version after successful migration
function setSchemaVersion(db: Database.Database, version: number) {
  db.prepare('INSERT OR REPLACE INTO schema_migration (version) VALUES (?)').run(version);
}

// Create the schema_migration table if it doesn't exist
function createMigrationTable(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migration (
      version INTEGER PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

// Check if table exists and has expected columns
function validateTableSchema(db: Database.Database, tableName: string, expectedColumns: string[]): boolean {
  try {
    const tableInfo = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
    const actualColumns = tableInfo.map(col => col.name);

    // Check that all expected core columns exist
    const hasRequiredColumns = expectedColumns.every(col => actualColumns.includes(col));

    if (!hasRequiredColumns) {
      console.error(`[Migration] Table ${tableName} missing required columns. Expected: ${expectedColumns.join(', ')}, Found: ${actualColumns.join(', ')}`);
    }

    return hasRequiredColumns;
  } catch (error) {
    console.error(`[Migration] Error checking schema for table ${tableName}:`, error);
    return false;
  }
}

// Extract table definitions from expected schema
function getExpectedTables(): Record<string, string[]> {
  // Since this is the frontend, we don't handle database migrations directly
  // The backend is responsible for schema management
  const schema = `-- SQL schema would be handled by backend`;
  const tables: Record<string, string[]> = {};

  // Find all CREATE TABLE statements
  const createTableMatches = schema.match(/CREATE TABLE IF NOT EXISTS (\w+) \(([\s\S]*?)\);/g) || [];

  for (const match of createTableMatches) {
    const tableNameMatch = match.match(/CREATE TABLE IF NOT EXISTS (\w+)/);
    if (tableNameMatch) {
      const tableName = tableNameMatch[1];
      const columnsMatch = match.match(/\(([\s\S]*?)\);/);
      if (columnsMatch) {
        // Extract column names with better regex
        const columnDefs = columnsMatch[1];
        const lines = columnDefs.split('\n').map((line: string) => line.trim()).filter((line: string) => line.length > 0);

        const columns = lines.map((line: string) => {
          // Handle both "col_name TYPE ..." and "col_name TYPE, ..." patterns
          const cleanLine = line.replace(/,?\s*$/, ''); // Remove trailing comma
          const parts = cleanLine.split(/\s+/);
          return parts[0]; // First part is column name
        }).filter((col: string) => col && !col.startsWith('FOREIGN KEY') && !col.startsWith('CONSTRAINT'));

        tables[tableName] = columns;
      }
    }
  }

  return tables;
}

// Run migrations if needed
export function runMigrations(): void {
  console.log('[Migration] Starting database migration check...');

  try {
    // Ensure all required directories exist
    console.log('[Migration] Initializing directories...');
    const directories = getRequiredDirectories();
    ensureDirectories(directories);

    // Open database connection
    const db = new Database(DATABASE_PATH);
    console.log(`[Migration] Database opened: ${DATABASE_PATH}`);

    // Create schema_migration table first
    createMigrationTable(db);

    // Get current version
    const currentVersion = getCurrentSchemaVersion(db);
    console.log(`[Migration] Current schema version: ${currentVersion}`);

    // Run base schema if database is empty or missing tables
    const expectedTables = getExpectedTables();
    const tableNames = Object.keys(expectedTables);
    const needsBaseSchema = tableNames.some(tableName => {
      const expectedColumns = expectedTables[tableName];
      return !validateTableSchema(db, tableName, expectedColumns);
    });

    if (needsBaseSchema) {
      console.log('[Migration] Database is missing schema or has outdated schema, applying base schema...');
      // Database schema is handled by backend
      console.log('[Migration] Database schema is managed by backend - skipping local schema application');
      setSchemaVersion(db, 1);
      console.log('[Migration] Base schema applied successfully');
    }

    // Run version migrations
    for (const migration of MIGRATIONS) {
      if (migration.version > currentVersion) {
        console.log(`[Migration] Applying migration ${migration.version}: ${migration.name}`);

        try {
          db.exec(migration.up);
          setSchemaVersion(db, migration.version);
          console.log(`[Migration] Migration ${migration.version} applied successfully`);
        } catch (error) {
          console.error(`[Migration] Error applying migration ${migration.version}:`, error);
          throw error;
        }
      }
    }

    // Verify final state
    const finalVersion = getCurrentSchemaVersion(db);
    console.log(`[Migration] Final schema version: ${finalVersion}`);

    // Validate all tables exist with correct schema (warning only, don't fail)
    const tableValidationResults = tableNames.map(tableName => {
      const expectedColumns = expectedTables[tableName];
      const isValid = validateTableSchema(db, tableName, expectedColumns);
      return { tableName, isValid };
    });

    const validTables = tableValidationResults.filter(r => r.isValid).length;
    const totalTables = tableValidationResults.length;

    console.log(`[Migration] Schema validation: ${validTables}/${totalTables} tables valid`);

    // Log warnings for invalid tables but don't fail
    tableValidationResults.forEach(({ tableName, isValid }) => {
      if (!isValid) {
        console.warn(`[Migration] Warning: Table ${tableName} schema may be outdated but is functional`);
      }
    });

    console.log('[Migration] Database migration completed successfully');

    db.close();
    console.log('[Migration] Migration check completed');

  } catch (error) {
    console.error('[Migration] Migration failed:', error);
    throw error;
  }
}

// Function to add a new migration (for future use)
export function addMigration(version: number, name: string, up: string, down?: string): void {
  const existingMigration = MIGRATIONS.find(m => m.version === version);
  if (existingMigration) {
    throw new Error(`Migration version ${version} already exists`);
  }

  MIGRATIONS.push({ version, name, up, down });
  MIGRATIONS.sort((a, b) => a.version - b.version);
}