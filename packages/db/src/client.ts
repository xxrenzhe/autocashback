import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import postgres from "postgres";

import { getServerEnv, type DatabaseType } from "./env";

type QueryRow = Record<string, unknown>;

export interface DatabaseAdapter {
  type: DatabaseType;
  query<T = QueryRow>(sql: string, params?: unknown[]): Promise<T[]>;
  exec(sql: string, params?: unknown[]): Promise<void>;
  close(): Promise<void> | void;
}

export interface SqlExecutor {
  <T = QueryRow[]>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  unsafe<T = QueryRow[]>(sql: string, params?: unknown[]): Promise<T>;
}

declare global {
  // eslint-disable-next-line no-var
  var __autocashback_db__: DatabaseAdapter | undefined;
  // eslint-disable-next-line no-var
  var __autocashback_sql_executor__: SqlExecutor | undefined;
}

function shouldReturnRows(sql: string) {
  return /^\s*(SELECT|WITH|PRAGMA)\b/i.test(sql) || /\bRETURNING\b/i.test(sql);
}

function compileTemplate(strings: TemplateStringsArray, values: unknown[]) {
  let text = "";

  for (let index = 0; index < strings.length; index += 1) {
    text += strings[index];

    if (index < values.length) {
      text += "?";
    }
  }

  return {
    text,
    params: values
  };
}

class SQLiteAdapter implements DatabaseAdapter {
  type: DatabaseType = "sqlite";
  private db: Database.Database;

  constructor(dbPath: string) {
    const directory = path.dirname(dbPath);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma("foreign_keys = ON");
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("synchronous = NORMAL");
  }

  async query<T = QueryRow>(sql: string, params: unknown[] = []) {
    return this.db.prepare(sql).all(...params) as T[];
  }

  async exec(sql: string, params: unknown[] = []) {
    if (!params.length) {
      this.db.exec(sql);
      return;
    }

    this.db.prepare(sql).run(...params);
  }

  close() {
    this.db.close();
  }
}

class PostgresAdapter implements DatabaseAdapter {
  type: DatabaseType = "postgres";
  private sql: postgres.Sql;

  constructor(connectionString: string) {
    this.sql = postgres(connectionString, {
      max: 5,
      idle_timeout: 20,
      prepare: false
    });
  }

  private convertPlaceholders(sql: string) {
    let index = 1;
    return sql.replace(/\?/g, () => `$${index++}`);
  }

  async query<T = QueryRow>(sql: string, params: unknown[] = []) {
    return this.sql.unsafe(
      this.convertPlaceholders(sql),
      params as postgres.ParameterOrJSON<never>[]
    ) as Promise<T[]>;
  }

  async exec(sql: string, params: unknown[] = []) {
    await this.sql.unsafe(
      this.convertPlaceholders(sql),
      params as postgres.ParameterOrJSON<never>[]
    );
  }

  close() {
    return this.sql.end();
  }
}

function createDatabaseAdapter() {
  const env = getServerEnv();

  if (env.DB_TYPE === "postgres") {
    return new PostgresAdapter(env.DATABASE_URL as string);
  }

  return new SQLiteAdapter(env.DATABASE_PATH);
}

function createSqlExecutor(db: DatabaseAdapter): SqlExecutor {
  const executor = (async <T = QueryRow[]>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ) => {
    const { text, params } = compileTemplate(strings, values);

    if (shouldReturnRows(text)) {
      return db.query(text, params) as Promise<T>;
    }

    await db.exec(text, params);
    return [] as T;
  }) as SqlExecutor;

  executor.unsafe = async <T = QueryRow[]>(sql: string, params: unknown[] = []) => {
    if (shouldReturnRows(sql)) {
      return db.query(sql, params) as Promise<T>;
    }

    await db.exec(sql, params);
    return [] as T;
  };

  return executor;
}

export function getDatabase() {
  if (!global.__autocashback_db__) {
    global.__autocashback_db__ = createDatabaseAdapter();
  }

  return global.__autocashback_db__;
}

export function getDbType() {
  return getDatabase().type;
}

export function getSql() {
  if (!global.__autocashback_sql_executor__) {
    global.__autocashback_sql_executor__ = createSqlExecutor(getDatabase());
  }

  return global.__autocashback_sql_executor__;
}

export async function closeDatabase() {
  if (global.__autocashback_db__) {
    await global.__autocashback_db__.close();
  }

  global.__autocashback_db__ = undefined;
  global.__autocashback_sql_executor__ = undefined;
}
