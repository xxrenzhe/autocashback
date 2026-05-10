const POSTGRES_PROTOCOL_PATTERN = /^(postgres(?:ql)?:\/\/)(.*)$/i;

export type PostgresConnectionTarget = {
  postgresHost: string | null;
  postgresPort: string | null;
  postgresDatabase: string | null;
};

function encodeUserInfoComponent(value: string) {
  try {
    return encodeURIComponent(decodeURIComponent(value));
  } catch {
    return encodeURIComponent(value);
  }
}

function normalizeUserInfo(userInfo: string) {
  const passwordSeparatorIndex = userInfo.indexOf(":");

  if (passwordSeparatorIndex === -1) {
    return encodeUserInfoComponent(userInfo);
  }

  const username = userInfo.slice(0, passwordSeparatorIndex);
  const password = userInfo.slice(passwordSeparatorIndex + 1);

  return `${encodeUserInfoComponent(username)}:${encodeUserInfoComponent(password)}`;
}

export function normalizePostgresConnectionString(connectionString: string) {
  const match = POSTGRES_PROTOCOL_PATTERN.exec(connectionString);

  if (!match) {
    return connectionString;
  }

  try {
    return new URL(connectionString).toString();
  } catch {
    const [, protocol, rest] = match;
    const userInfoSeparatorIndex = rest.lastIndexOf("@");

    if (userInfoSeparatorIndex === -1) {
      return connectionString;
    }

    const pathSeparatorIndex = ["/", "?", "#"]
      .map((separator) => rest.indexOf(separator, userInfoSeparatorIndex + 1))
      .filter((index) => index !== -1)
      .sort((left, right) => left - right)[0];
    const authorityEndIndex = pathSeparatorIndex ?? rest.length;
    const authority = rest.slice(0, authorityEndIndex);
    const suffix = rest.slice(authorityEndIndex);
    const authorityUserInfoSeparatorIndex = authority.lastIndexOf("@");
    const userInfo = authority.slice(0, authorityUserInfoSeparatorIndex);
    const hostInfo = authority.slice(authorityUserInfoSeparatorIndex + 1);

    return `${protocol}${normalizeUserInfo(userInfo)}@${hostInfo}${suffix}`;
  }
}

export function parsePostgresConnectionTarget(
  connectionString: string
): PostgresConnectionTarget {
  try {
    const parsed = new URL(normalizePostgresConnectionString(connectionString));
    return {
      postgresHost: parsed.hostname,
      postgresPort: parsed.port || null,
      postgresDatabase: decodeURIComponent(parsed.pathname.replace(/^\//, "")) || null
    };
  } catch {
    return {
      postgresHost: null,
      postgresPort: null,
      postgresDatabase: null
    };
  }
}
