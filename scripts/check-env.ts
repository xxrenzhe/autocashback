import { getServerEnv } from "@autocashback/db";

try {
  getServerEnv();
  console.log("[env] required production environment variables are valid");
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : "unknown env error";
  console.error("[env] validation failed:", message);
  process.exit(1);
}
