import { spawn } from "node:child_process";

import { createServiceLogger } from "@autocashback/db";

const logger = createServiceLogger("autocashback-runtime");

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function runCommand(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(npmCommand(), args, {
      env: process.env,
      stdio: "inherit"
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${args.join(" ")} exited with code ${code}`));
    });
    child.on("error", reject);
  });
}

async function runPreflight() {
  logger.info("runtime_preflight_start");
  await runCommand(["run", "env:check"]);
  await runCommand(["run", "db:bootstrap"]);
  logger.info("runtime_preflight_complete");
}

async function main() {
  await runPreflight();
  process.env.SKIP_RUNTIME_DB_INIT = "true";
  logger.info("runtime_env_updated", {
    skipRuntimeDbInit: true
  });

  const web = spawn(npmCommand(), ["run", "service:web"], {
    env: {
      ...process.env,
      SERVICE_NAME: "autocashback-web",
      SKIP_RUNTIME_DB_INIT: "true"
    },
    stdio: "inherit"
  });
  const scheduler = spawn(npmCommand(), ["run", "service:scheduler"], {
    env: {
      ...process.env,
      SERVICE_NAME: "autocashback-scheduler"
    },
    stdio: "inherit"
  });

  logger.info("runtime_services_started", {
    webPid: web.pid || null,
    schedulerPid: scheduler.pid || null
  });

  let shuttingDown = false;
  const shutdown = (signal: NodeJS.Signals) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    logger.warn("runtime_shutdown_signal", {
      signal
    });
    web.kill(signal);
    scheduler.kill(signal);
    setTimeout(() => {
      if (!web.killed) {
        web.kill("SIGKILL");
      }
      if (!scheduler.killed) {
        scheduler.kill("SIGKILL");
      }
    }, 8_000).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  const handleExit = (service: "web" | "scheduler", code: number | null, signal: NodeJS.Signals | null) => {
    logger.warn("runtime_service_exit", {
      service,
      code,
      signal
    });
    shutdown("SIGTERM");
    process.exit(code ?? (signal ? 1 : 0));
  };

  web.on("exit", (code, signal) => handleExit("web", code, signal));
  scheduler.on("exit", (code, signal) => handleExit("scheduler", code, signal));
}

main().catch((error) => {
  logger.error("runtime_start_failed", {}, error);
  process.exit(1);
});
