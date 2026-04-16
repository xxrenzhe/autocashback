import "./load-env";

import {
  createServiceLogger,
  ensureDatabaseSchema,
  ensurePostgresDatabaseExists,
  getServerEnv
} from "@autocashback/db";

const logger = createServiceLogger("autocashback-db-migrate");

function parseDatabaseTarget(databaseUrl: string) {
  try {
    const parsed = new URL(databaseUrl);
    return {
      postgresHost: parsed.hostname,
      postgresPort: parsed.port || null,
      postgresDatabase: parsed.pathname.replace(/^\//, "") || null
    };
  } catch {
    return {
      postgresHost: null,
      postgresPort: null,
      postgresDatabase: null
    };
  }
}

async function main() {
  const env = getServerEnv();
  logger.info("db_migrate_start", {
    dbType: env.DB_TYPE
  });

  if (env.DB_TYPE === "postgres") {
    logger.info("db_migrate_target", parseDatabaseTarget(env.DATABASE_URL || ""));
    await ensurePostgresDatabaseExists(env.DATABASE_URL as string);
  } else {
    logger.info("db_migrate_target", {
      databasePath: env.DATABASE_PATH
    });
  }

  await ensureDatabaseSchema();
  logger.info("db_migrate_complete");
}

main().catch((error) => {
  logger.error("db_migrate_failed", {}, error);
  process.exit(1);
});
