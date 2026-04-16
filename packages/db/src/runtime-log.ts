import util from "node:util";

type LogLevel = "debug" | "info" | "warn" | "error";
type LogFields = Record<string, unknown>;

const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

function resolveLogLevel(): LogLevel {
  const value = String(process.env.LOG_LEVEL || "info").trim().toLowerCase();
  if (value === "debug" || value === "info" || value === "warn" || value === "error") {
    return value;
  }

  return "info";
}

function shouldLog(level: LogLevel) {
  return LOG_LEVEL_ORDER[level] >= LOG_LEVEL_ORDER[resolveLogLevel()];
}

function serializeError(error: unknown): Record<string, unknown> | undefined {
  if (!error) {
    return undefined;
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  return {
    message: String(error)
  };
}

function writeLogLine(payload: Record<string, unknown>, level: LogLevel) {
  const line = `${JSON.stringify(payload)}\n`;
  if (level === "error") {
    process.stderr.write(line);
    return;
  }

  process.stdout.write(line);
}

function baseFields(serviceName?: string): Record<string, unknown> {
  return {
    ts: new Date().toISOString(),
    service: serviceName || process.env.SERVICE_NAME || "autocashback",
    env: process.env.NODE_ENV || "development",
    instanceId: process.env.HOSTNAME || process.env.INSTANCE_ID || null,
    pid: process.pid
  };
}

function log(level: LogLevel, msg: string, fields: LogFields = {}, error?: unknown, serviceName?: string) {
  if (!shouldLog(level)) {
    return;
  }

  const payload: Record<string, unknown> = {
    ...baseFields(serviceName),
    level,
    msg,
    ...fields
  };

  const serializedError = serializeError(error);
  if (serializedError) {
    payload.err = serializedError;
  }

  writeLogLine(payload, level);
}

export function createServiceLogger(serviceName: string) {
  return {
    debug(msg: string, fields: LogFields = {}) {
      log("debug", msg, fields, undefined, serviceName);
    },
    info(msg: string, fields: LogFields = {}) {
      log("info", msg, fields, undefined, serviceName);
    },
    warn(msg: string, fields: LogFields = {}) {
      log("warn", msg, fields, undefined, serviceName);
    },
    error(msg: string, fields: LogFields = {}, error?: unknown) {
      log("error", msg, fields, error, serviceName);
    }
  };
}

export const logger = createServiceLogger(process.env.SERVICE_NAME || "autocashback");

function findFirstError(args: unknown[]) {
  return args.find((arg) => arg instanceof Error);
}

export function patchConsoleToStructuredOnce(serviceName?: string) {
  const anyConsole = console as typeof console & { __structuredPatched?: boolean };
  if (anyConsole.__structuredPatched) {
    return;
  }

  anyConsole.__structuredPatched = true;
  const scopedLogger = createServiceLogger(serviceName || process.env.SERVICE_NAME || "autocashback");

  console.debug = (...args: unknown[]) => scopedLogger.debug(util.format(...args), { source: "console" });
  console.log = (...args: unknown[]) => scopedLogger.info(util.format(...args), { source: "console" });
  console.info = (...args: unknown[]) => scopedLogger.info(util.format(...args), { source: "console" });
  console.warn = (...args: unknown[]) => scopedLogger.warn(util.format(...args), { source: "console" });
  console.error = (...args: unknown[]) => {
    scopedLogger.error(
      util.format(...args),
      { source: "console" },
      findFirstError(args)
    );
  };
}
