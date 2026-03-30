import "./load-env";

import {
  ensureDatabaseSchema,
  ensurePostgresDatabaseExists,
  getServerEnv
} from "@autocashback/db";

async function main() {
  const env = getServerEnv();
  console.log(`[db] migrating ${env.DB_TYPE} database`);

  if (env.DB_TYPE === "postgres") {
    console.log("[db] ensuring target postgres database exists");
    await ensurePostgresDatabaseExists(env.DATABASE_URL as string);
  } else {
    console.log(`[db] sqlite path: ${env.DATABASE_PATH}`);
  }

  await ensureDatabaseSchema();
  console.log("[db] schema and migrations ensured");
}

main().catch((error) => {
  console.error("[db] migration failed", error);
  process.exit(1);
});
