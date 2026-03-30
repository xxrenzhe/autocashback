import "./load-env";

import { ensureDatabaseReady, getServerEnv } from "@autocashback/db";

async function main() {
  const env = getServerEnv();
  console.log(`[db] bootstrapping ${env.DB_TYPE} database`);
  if (env.DB_TYPE === "sqlite") {
    console.log(`[db] sqlite path: ${env.DATABASE_PATH}`);
  }
  await ensureDatabaseReady();
  console.log("[db] schema and default admin ensured");
}

main().catch((error) => {
  console.error("[db] bootstrap failed", error);
  process.exit(1);
});
