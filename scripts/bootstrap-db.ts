import { ensureDatabaseReady } from "@autocashback/db";

async function main() {
  await ensureDatabaseReady();
  console.log("[db] schema and default admin ensured");
}

main().catch((error) => {
  console.error("[db] bootstrap failed", error);
  process.exit(1);
});
