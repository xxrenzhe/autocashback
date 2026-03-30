import postgres from "postgres";

import { getServerEnv } from "./env";

declare global {
  // eslint-disable-next-line no-var
  var __autocashback_sql__: postgres.Sql | undefined;
}

export function getSql() {
  if (!global.__autocashback_sql__) {
    const env = getServerEnv();
    global.__autocashback_sql__ = postgres(env.DATABASE_URL, {
      max: 5,
      idle_timeout: 20,
      prepare: false
    });
  }

  return global.__autocashback_sql__;
}
