import { spawn } from "node:child_process";
import readline from "node:readline";

import { createServiceLogger } from "@autocashback/db";

type ServiceName = "web" | "scheduler";

function resolveServiceConfig(service: ServiceName) {
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

  if (service === "web") {
    return {
      serviceName: "autocashback-web",
      command: npmCommand,
      args: ["--workspace", "@autocashback/web", "run", "start"]
    };
  }

  return {
    serviceName: "autocashback-scheduler",
    command: npmCommand,
    args: ["run", "start:scheduler"]
  };
}

function pipeChildStream(
  serviceName: string,
  stream: "stdout" | "stderr",
  input: NodeJS.ReadableStream | null
) {
  if (!input) {
    return;
  }

  const logger = createServiceLogger(serviceName);
  const reader = readline.createInterface({ input });
  reader.on("line", (line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }

    try {
      JSON.parse(trimmed);
      if (stream === "stderr") {
        process.stderr.write(`${trimmed}\n`);
      } else {
        process.stdout.write(`${trimmed}\n`);
      }
      return;
    } catch {
      // Fall through and wrap non-JSON output.
    }

    if (stream === "stderr") {
      logger.error("service_stream", {
        stream,
        line: trimmed
      });
      return;
    }

    logger.info("service_stream", {
      stream,
      line: trimmed
    });
  });
}

async function main() {
  const arg = process.argv[2];
  if (arg !== "web" && arg !== "scheduler") {
    process.stderr.write("Usage: tsx scripts/run-managed-service.ts <web|scheduler>\n");
    process.exit(1);
  }

  const config = resolveServiceConfig(arg);
  const logger = createServiceLogger(config.serviceName);
  const child = spawn(config.command, config.args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      SERVICE_NAME: config.serviceName
    },
    stdio: ["inherit", "pipe", "pipe"]
  });

  logger.info("service_boot", {
    command: config.command,
    args: config.args,
    childPid: child.pid || null
  });

  pipeChildStream(config.serviceName, "stdout", child.stdout);
  pipeChildStream(config.serviceName, "stderr", child.stderr);

  let shutdownStarted = false;
  const forwardSignal = (signal: NodeJS.Signals) => {
    if (shutdownStarted) {
      return;
    }

    shutdownStarted = true;
    logger.warn("service_shutdown_signal", {
      signal,
      childPid: child.pid || null
    });
    child.kill(signal);
    setTimeout(() => {
      if (!child.killed) {
        child.kill("SIGKILL");
      }
    }, 8_000).unref();
  };

  process.on("SIGINT", () => forwardSignal("SIGINT"));
  process.on("SIGTERM", () => forwardSignal("SIGTERM"));

  child.on("exit", (code, signal) => {
    logger.info("service_exit", {
      code,
      signal
    });
    process.exit(code ?? (signal ? 1 : 0));
  });

  child.on("error", (error) => {
    logger.error("service_spawn_failed", {}, error);
    process.exit(1);
  });
}

void main();
