import "./load-env";

import { createServiceLogger, getServerEnv } from "@autocashback/db";

const logger = createServiceLogger("autocashback-preflight");

try {
  getServerEnv();
  logger.info("env_validation_passed");
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : "unknown env error";
  logger.error("env_validation_failed", {
    message
  });
  process.exit(1);
}
