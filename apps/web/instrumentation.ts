function getRuntimeRequire() {
  return Function("return require")() as NodeRequire;
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  try {
    const runtimeRequire = getRuntimeRequire();
    const { ensureDatabaseReady, createServiceLogger, patchConsoleToStructuredOnce } = runtimeRequire(
      "@autocashback/db"
    ) as typeof import("@autocashback/db");
    const logger = createServiceLogger("autocashback-web");

    patchConsoleToStructuredOnce("autocashback-web");
    logger.info("web_runtime_boot", {
      skipRuntimeDbInit: process.env.SKIP_RUNTIME_DB_INIT === "true"
    });

    if (process.env.SKIP_RUNTIME_DB_INIT === "true") {
      logger.info("web_runtime_db_init_skipped");
      return;
    }

    await ensureDatabaseReady();
    logger.info("web_runtime_db_init_complete");
  } catch (error) {
    const runtimeRequire = getRuntimeRequire();
    const { createServiceLogger } = runtimeRequire("@autocashback/db") as typeof import("@autocashback/db");
    createServiceLogger("autocashback-web").error("web_runtime_boot_failed", {}, error);
    throw error;
  }
}
