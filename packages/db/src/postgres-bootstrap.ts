import postgres from "postgres";

const POSTGRES_ADMIN_DATABASE = "postgres";
const DUPLICATE_DATABASE_ERROR = "42P04";

function getTargetDatabaseName(connectionString: string) {
  const url = new URL(connectionString);
  const databaseName = decodeURIComponent(url.pathname.replace(/^\/+/, ""));

  if (!databaseName) {
    throw new Error("DATABASE_URL must include a PostgreSQL database name");
  }

  return databaseName;
}

function getAdminConnectionString(connectionString: string) {
  const url = new URL(connectionString);
  url.pathname = `/${POSTGRES_ADMIN_DATABASE}`;
  return url.toString();
}

function quoteIdentifier(identifier: string) {
  return `"${identifier.replace(/"/g, "\"\"")}"`;
}

function isDuplicateDatabaseError(error: unknown): error is { code: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === DUPLICATE_DATABASE_ERROR
  );
}

export async function ensurePostgresDatabaseExists(connectionString: string) {
  const databaseName = getTargetDatabaseName(connectionString);
  const adminConnectionString = getAdminConnectionString(connectionString);
  const adminSql = postgres(adminConnectionString, {
    max: 1,
    idle_timeout: 5,
    prepare: false
  });

  try {
    const existing = await adminSql<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1
        FROM pg_database
        WHERE datname = ${databaseName}
      ) AS exists
    `;

    if (existing[0]?.exists) {
      return;
    }

    try {
      await adminSql.unsafe(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);
    } catch (error) {
      if (!isDuplicateDatabaseError(error)) {
        throw error;
      }
    }
  } finally {
    await adminSql.end();
  }
}
