export type DatabaseType = "sqlite" | "postgres";

export function nowExpression(dbType: DatabaseType) {
  return dbType === "postgres" ? "CURRENT_TIMESTAMP" : "CURRENT_TIMESTAMP";
}

export function countAsInt(expression: string, dbType: DatabaseType) {
  return dbType === "postgres" ? `${expression}::int` : expression;
}

export function nullableTextFilter(column: string, dbType: DatabaseType) {
  return dbType === "postgres"
    ? "(?::text IS NULL OR " + column + " = ?)"
    : "(? IS NULL OR " + column + " = ?)";
}

export function plusMinutesExpression(minutes: number, dbType: DatabaseType) {
  return dbType === "postgres"
    ? `${nowExpression(dbType)} + ('${minutes} minutes')::interval`
    : `datetime('now', '+${minutes} minutes')`;
}

export function currentTimestampColumnDefinition(dbType: DatabaseType) {
  return dbType === "postgres"
    ? "TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP"
    : "TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP";
}

export function nullableTimestampColumnDefinition(dbType: DatabaseType) {
  return dbType === "postgres" ? "TIMESTAMPTZ" : "TEXT";
}

export function primaryKeyColumnDefinition(dbType: DatabaseType) {
  return dbType === "postgres" ? "SERIAL PRIMARY KEY" : "INTEGER PRIMARY KEY AUTOINCREMENT";
}

export function decimalColumnDefinition(dbType: DatabaseType, defaultValue: number) {
  return dbType === "postgres"
    ? `NUMERIC(10, 2) NOT NULL DEFAULT ${defaultValue}`
    : `REAL NOT NULL DEFAULT ${defaultValue}`;
}

export function booleanColumnDefinition(dbType: DatabaseType, defaultValue: boolean) {
  if (dbType === "postgres") {
    return `BOOLEAN NOT NULL DEFAULT ${defaultValue ? "TRUE" : "FALSE"}`;
  }

  return `INTEGER NOT NULL DEFAULT ${defaultValue ? 1 : 0}`;
}

export function booleanValue(value: boolean, dbType: DatabaseType) {
  return dbType === "postgres" ? value : value ? 1 : 0;
}

export function successRateExpression(dbType: DatabaseType) {
  if (dbType === "postgres") {
    return `ROUND(
      100.0 * COUNT(*) FILTER (WHERE status = 'success') / NULLIF(COUNT(*), 0),
      2
    )`;
  }

  return `ROUND(
    100.0 * SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0),
    2
  )`;
}
