import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { getDbType, getSql } from "./client";
import type { DatabaseType } from "./env";
import { countAsInt } from "./sql-helpers";
import { splitSqlStatements } from "./sql-splitter";

const SQLITE_INIT_SCHEMA_FILE = "000_init_schema_consolidated.sqlite.sql";
const POSTGRES_INIT_SCHEMA_FILE = "000_init_schema_consolidated.pg.sql";
const SQLITE_MIGRATIONS_DIR = "migrations";
const POSTGRES_MIGRATIONS_DIR = "pg-migrations";
const CRITICAL_TABLES = [
  "users",
  "cashback_platforms",
  "cashback_accounts",
  "offers",
  "link_swap_tasks",
  "link_swap_runs",
  "system_settings",
  "script_tokens"
];

function calculateFileHash(content: string) {
  return crypto.createHash("md5").update(content).digest("hex");
}

function getProjectRoot() {
  return process.cwd();
}

function getMigrationsDir(dbType: DatabaseType) {
  const relativeDir = dbType === "postgres" ? POSTGRES_MIGRATIONS_DIR : SQLITE_MIGRATIONS_DIR;
  const absoluteDir = path.join(getProjectRoot(), relativeDir);

  if (!fs.existsSync(absoluteDir)) {
    throw new Error(`Migration directory not found: ${absoluteDir}`);
  }

  return absoluteDir;
}

function getInitSchemaPath(dbType: DatabaseType) {
  const directory = getMigrationsDir(dbType);
  const filename = dbType === "postgres" ? POSTGRES_INIT_SCHEMA_FILE : SQLITE_INIT_SCHEMA_FILE;
  const fullPath = path.join(directory, filename);

  if (!fs.existsSync(fullPath)) {
    throw new Error(`Consolidated schema file not found: ${fullPath}`);
  }

  return fullPath;
}

function getPendingMigrationFiles(dbType: DatabaseType) {
  return fs
    .readdirSync(getMigrationsDir(dbType))
    .filter((filename) =>
      dbType === "postgres"
        ? filename.endsWith(".pg.sql")
        : filename.endsWith(".sql") && !filename.endsWith(".pg.sql")
    )
    .filter((filename) => !filename.startsWith("000_"))
    .sort();
}

async function ensureMigrationHistorySchema() {
  const sql = getSql();
  const dbType = getDbType();

  if (dbType === "sqlite") {
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS migration_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        migration_name TEXT NOT NULL UNIQUE,
        file_hash TEXT,
        executed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const columns = await sql.unsafe<{ name: string }[]>(`PRAGMA table_info(migration_history)`);
    const columnNames = new Set(columns.map((column) => column.name));

    if (!columnNames.has("file_hash")) {
      await sql.unsafe(`ALTER TABLE migration_history ADD COLUMN file_hash TEXT`);
    }

    if (!columnNames.has("executed_at")) {
      await sql.unsafe(
        `ALTER TABLE migration_history ADD COLUMN executed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP`
      );
    }

    return;
  }

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS migration_history (
      id SERIAL PRIMARY KEY,
      migration_name TEXT NOT NULL UNIQUE,
      file_hash TEXT,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const fileHashColumn = await sql.unsafe<{ count: number }[]>(
    `
      SELECT ${countAsInt("COUNT(*)", dbType)} AS count
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'migration_history'
        AND column_name = ?
    `,
    ["file_hash"]
  );

  if (!fileHashColumn[0]?.count) {
    await sql.unsafe(`ALTER TABLE migration_history ADD COLUMN file_hash TEXT`);
  }

  const executedAtColumn = await sql.unsafe<{ count: number }[]>(
    `
      SELECT ${countAsInt("COUNT(*)", dbType)} AS count
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'migration_history'
        AND column_name = ?
    `,
    ["executed_at"]
  );

  if (!executedAtColumn[0]?.count) {
    await sql.unsafe(
      `ALTER TABLE migration_history ADD COLUMN executed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`
    );
  }
}

async function tableExists(tableName: string) {
  const sql = getSql();
  const dbType = getDbType();

  if (dbType === "sqlite") {
    const rows = await sql.unsafe<{ count: number }[]>(
      `
        SELECT COUNT(*) AS count
        FROM sqlite_master
        WHERE type = 'table'
          AND name = ?
      `,
      [tableName]
    );

    return Boolean(rows[0]?.count);
  }

  const rows = await sql.unsafe<{ count: number }[]>(
    `
      SELECT ${countAsInt("COUNT(*)", dbType)} AS count
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ?
    `,
    [tableName]
  );

  return Boolean(rows[0]?.count);
}

async function isDatabaseInitialized() {
  for (const tableName of CRITICAL_TABLES) {
    if (!(await tableExists(tableName))) {
      return false;
    }
  }

  return true;
}

async function applySqlText(sqlText: string) {
  const sql = getSql();

  for (const statement of splitSqlStatements(sqlText)) {
    await sql.unsafe(statement);
  }
}

async function getAppliedMigrations() {
  const sql = getSql();
  const rows = await sql.unsafe<{ migration_name: string; file_hash: string | null }[]>(
    `
      SELECT migration_name, file_hash
      FROM migration_history
    `
  );

  return new Map(rows.map((row) => [row.migration_name, row.file_hash]));
}

async function recordMigration(migrationName: string, fileHash: string) {
  const sql = getSql();
  await sql.unsafe(
    `
      INSERT INTO migration_history (migration_name, file_hash, executed_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT (migration_name) DO UPDATE
      SET file_hash = excluded.file_hash,
          executed_at = CURRENT_TIMESTAMP
    `,
    [migrationName, fileHash]
  );
}

export async function runPendingDatabaseMigrations() {
  await ensureMigrationHistorySchema();

  const dbType = getDbType();
  const appliedMigrations = await getAppliedMigrations();

  for (const filename of getPendingMigrationFiles(dbType)) {
    const fullPath = path.join(getMigrationsDir(dbType), filename);
    const sqlText = fs.readFileSync(fullPath, "utf8");
    const fileHash = calculateFileHash(sqlText);

    if (appliedMigrations.get(filename) === fileHash) {
      continue;
    }

    await applySqlText(sqlText);
    await recordMigration(filename, fileHash);
  }
}

export async function ensureDatabaseSchema() {
  await ensureMigrationHistorySchema();

  const dbType = getDbType();
  const initSchemaPath = getInitSchemaPath(dbType);
  const initSchemaFilename = path.basename(initSchemaPath);
  const initSchemaText = fs.readFileSync(initSchemaPath, "utf8");

  if (!(await isDatabaseInitialized())) {
    await applySqlText(initSchemaText);
  }

  await recordMigration(initSchemaFilename, calculateFileHash(initSchemaText));
  await runPendingDatabaseMigrations();
}
