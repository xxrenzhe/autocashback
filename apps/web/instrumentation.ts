type InstrumentationLogLevel = "info" | "error";

function writeInstrumentationLog(level: InstrumentationLogLevel, msg: string, error?: unknown) {
  const payload: Record<string, unknown> = {
    ts: new Date().toISOString(),
    service: "autocashback-web",
    env: process.env.NODE_ENV || "development",
    instanceId: process.env.HOSTNAME || process.env.INSTANCE_ID || null,
    pid: process.pid,
    level,
    msg
  };

  if (error instanceof Error) {
    payload.err = {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  } else if (error) {
    payload.err = {
      message: String(error)
    };
  }

  const line = `${JSON.stringify(payload)}\n`;
  if (level === "error") {
    process.stderr.write(line);
    return;
  }

  process.stdout.write(line);
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  if (process.env.SKIP_RUNTIME_DB_INIT === "true") {
    writeInstrumentationLog("info", "web_runtime_db_init_skipped");
    return;
  }

  writeInstrumentationLog("info", "web_runtime_db_init_deferred");
}
