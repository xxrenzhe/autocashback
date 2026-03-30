import path from "node:path";

import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1).optional(),
  DATABASE_PATH: z.string().min(1).optional(),
  REDIS_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  INTERNAL_APP_URL: z.string().url(),
  NODE_ENV: z.enum(["development", "test", "production"]),
  TZ: z.string().min(1),
  DEFAULT_ADMIN_PASSWORD: z.string().min(1)
});

export type DatabaseType = "sqlite" | "postgres";

export type ServerEnv = z.infer<typeof serverEnvSchema> & {
  DATABASE_PATH: string;
  DB_TYPE: DatabaseType;
};

function resolveDatabaseType(databaseUrl?: string, databasePath?: string): DatabaseType {
  if (databaseUrl?.startsWith("postgresql://") || databaseUrl?.startsWith("postgres://")) {
    return "postgres";
  }

  if (databaseUrl?.startsWith("file:") || databasePath) {
    return "sqlite";
  }

  return "sqlite";
}

function resolveDatabasePath(databaseUrl?: string, databasePath?: string) {
  if (databasePath) {
    return databasePath;
  }

  if (databaseUrl?.startsWith("file:")) {
    return databaseUrl.slice("file:".length);
  }

  return path.join(process.cwd(), "data", "autocashback.db");
}

export function getServerEnv(overrides?: Partial<NodeJS.ProcessEnv>): ServerEnv {
  const result = serverEnvSchema.safeParse({
    DATABASE_URL: overrides?.DATABASE_URL ?? process.env.DATABASE_URL,
    DATABASE_PATH: overrides?.DATABASE_PATH ?? process.env.DATABASE_PATH,
    REDIS_URL: overrides?.REDIS_URL ?? process.env.REDIS_URL,
    JWT_SECRET: overrides?.JWT_SECRET ?? process.env.JWT_SECRET,
    ENCRYPTION_KEY: overrides?.ENCRYPTION_KEY ?? process.env.ENCRYPTION_KEY,
    NEXT_PUBLIC_APP_URL:
      overrides?.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL,
    INTERNAL_APP_URL: overrides?.INTERNAL_APP_URL ?? process.env.INTERNAL_APP_URL,
    NODE_ENV: overrides?.NODE_ENV ?? process.env.NODE_ENV,
    TZ: overrides?.TZ ?? process.env.TZ,
    DEFAULT_ADMIN_PASSWORD:
      overrides?.DEFAULT_ADMIN_PASSWORD ?? process.env.DEFAULT_ADMIN_PASSWORD
  });

  if (!result.success) {
    throw new Error(result.error.issues.map((issue) => issue.message).join("; "));
  }

  const env = result.data;
  const dbType = resolveDatabaseType(env.DATABASE_URL, env.DATABASE_PATH);
  const databasePath = resolveDatabasePath(env.DATABASE_URL, env.DATABASE_PATH);

  if (env.NODE_ENV === "production" && dbType !== "postgres") {
    throw new Error("DATABASE_URL with a PostgreSQL connection string is required in production");
  }

  return {
    ...env,
    DATABASE_PATH: databasePath,
    DB_TYPE: dbType
  };
}
