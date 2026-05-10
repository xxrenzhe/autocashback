import "./load-env";

import {
  createServiceLogger,
  ensureDatabaseReady,
  ensurePostgresDatabaseExists,
  getServerEnv,
  parsePostgresConnectionTarget
} from "@autocashback/db";

const logger = createServiceLogger("autocashback-db-bootstrap");

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
    logger.info("db_bootstrap_target", parsePostgresConnectionTarget(env.DATABASE_URL || ""));
    await ensurePostgresDatabaseExists(env.DATABASE_URL as string);
  }
  await ensureDatabaseReady();
  logger.info("db_bootstrap_complete");
}

main().catch((error) => {
  logger.error("db_bootstrap_failed", {}, error);
  process.exit(1);
});
