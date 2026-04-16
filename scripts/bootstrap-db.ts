import "./load-env";

import {
  createServiceLogger,
  ensureDatabaseReady,
  ensurePostgresDatabaseExists,
  getServerEnv
} from "@autocashback/db";

const logger = createServiceLogger("autocashback-db-bootstrap");

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
  logger.info("db_bootstrap_start", {
    dbType: env.DB_TYPE
  });
  if (env.DB_TYPE === "sqlite") {
    logger.info("db_bootstrap_target", {
      databasePath: env.DATABASE_PATH
    });
  }
  if (env.DB_TYPE === "postgres") {
    logger.info("db_bootstrap_target", parseDatabaseTarget(env.DATABASE_URL || ""));
    await ensurePostgresDatabaseExists(env.DATABASE_URL as string);
  }
  await ensureDatabaseReady();
  logger.info("db_bootstrap_complete");
}

main().catch((error) => {
  logger.error("db_bootstrap_failed", {}, error);
  process.exit(1);
});
