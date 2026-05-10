import "./load-env";

import {
  createServiceLogger,
  ensureDatabaseSchema,
  ensurePostgresDatabaseExists,
  getServerEnv,
  parsePostgresConnectionTarget
} from "@autocashback/db";

const logger = createServiceLogger("autocashback-db-migrate");

async function main() {
  const env = getServerEnv();
  logger.info("db_migrate_start", {
    dbType: env.DB_TYPE
  });

  if (env.DB_TYPE === "postgres") {
    logger.info("db_migrate_target", parsePostgresConnectionTarget(env.DATABASE_URL || ""));
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
