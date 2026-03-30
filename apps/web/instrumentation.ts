function getRuntimeRequire() {
  return Function("return require")() as NodeRequire;
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  if (process.env.SKIP_RUNTIME_DB_INIT === "true") {
    console.log("[db] SKIP_RUNTIME_DB_INIT=true, skipping Next.js runtime bootstrap");
    return;
  }

  try {
    const runtimeRequire = getRuntimeRequire();
    const { ensureDatabaseReady } = runtimeRequire("@autocashback/db") as typeof import("@autocashback/db");
    await ensureDatabaseReady();
    console.log("[db] runtime bootstrap complete");
  } catch (error) {
    console.error("[db] runtime bootstrap failed", error);
    throw error;
  }
}
