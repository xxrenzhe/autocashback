export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";

  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inBacktick = false;
  let inLineComment = false;
  let inBlockComment = false;
  let inDollarBlock = false;
  let inTrigger = false;
  let dollarTag = "";

  const pushCurrent = () => {
    const trimmed = current.trim();
    if (trimmed) {
      statements.push(trimmed);
    }
    current = "";
    inTrigger = false;
  };

  const endsWithTriggerEnd = (text: string) => {
    const withoutTrailing = text.replace(/[\s;]*$/g, "");
    return /\bEND\b\s*$/i.test(withoutTrailing);
  };

  const maybeEnterTrigger = () => {
    if (inTrigger) {
      return;
    }

    const prefix = current.trimStart().slice(0, 80).toUpperCase();
    if (prefix.startsWith("CREATE TRIGGER") || prefix.startsWith("CREATE TEMP TRIGGER")) {
      inTrigger = true;
    }
  };

  const tryConsumeDollarTag = (
    source: string,
    startIndex: number
  ): { tag: string; endIndex: number } | null => {
    let tag = "$";
    let index = startIndex + 1;

    while (index < source.length && /[a-zA-Z0-9_]/.test(source[index] ?? "")) {
      tag += source[index];
      index += 1;
    }

    if (index < source.length && source[index] === "$") {
      tag += "$";
      return {
        tag,
        endIndex: index + 1
      };
    }

    return null;
  };

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index] ?? "";
    const next = sql[index + 1] ?? "";

    if (inLineComment) {
      if (char === "\n") {
        inLineComment = false;
        current += char;
      }
      continue;
    }

    if (inBlockComment) {
      if (char === "*" && next === "/") {
        inBlockComment = false;
        index += 1;
      }
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && !inBacktick && !inDollarBlock) {
      if (char === "-" && next === "-") {
        inLineComment = true;
        index += 1;
        continue;
      }

      if (char === "/" && next === "*") {
        inBlockComment = true;
        index += 1;
        continue;
      }
    }

    if (!inSingleQuote && !inDoubleQuote && !inBacktick && char === "$") {
      const consumed = tryConsumeDollarTag(sql, index);
      if (consumed) {
        if (!inDollarBlock) {
          inDollarBlock = true;
          dollarTag = consumed.tag;
          current += consumed.tag;
          index = consumed.endIndex - 1;
          continue;
        }

        if (consumed.tag === dollarTag) {
          inDollarBlock = false;
          dollarTag = "";
          current += consumed.tag;
          index = consumed.endIndex - 1;
          continue;
        }
      }
    }

    if (inDollarBlock) {
      current += char;
      continue;
    }

    if (!inDoubleQuote && !inBacktick) {
      if (char === "'" && !inSingleQuote) {
        inSingleQuote = true;
      } else if (char === "'" && inSingleQuote) {
        if (next === "'") {
          current += char + next;
          index += 1;
          continue;
        }
        inSingleQuote = false;
      }
    }

    if (!inSingleQuote && !inBacktick) {
      if (char === "\"" && !inDoubleQuote) {
        inDoubleQuote = true;
      } else if (char === "\"" && inDoubleQuote) {
        inDoubleQuote = false;
      }
    }

    if (!inSingleQuote && !inDoubleQuote) {
      if (char === "`" && !inBacktick) {
        inBacktick = true;
      } else if (char === "`" && inBacktick) {
        inBacktick = false;
      }
    }

    current += char;
    maybeEnterTrigger();

    if (!inSingleQuote && !inDoubleQuote && !inBacktick && char === ";") {
      if (inTrigger) {
        if (endsWithTriggerEnd(current)) {
          pushCurrent();
        }
      } else {
        pushCurrent();
      }
    }
  }

  if (current.trim()) {
    statements.push(current.trim());
  }

  return statements;
}
