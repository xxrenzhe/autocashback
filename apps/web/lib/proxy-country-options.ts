const BASE_PROXY_COUNTRY_CODES = [
  "US",
  "CA",
  "MX",
  "GB",
  "DE",
  "FR",
  "IT",
  "ES",
  "PT",
  "NL",
  "BE",
  "AT",
  "CH",
  "SE",
  "NO",
  "DK",
  "FI",
  "PL",
  "CZ",
  "HU",
  "GR",
  "IE",
  "RO",
  "BG",
  "HR",
  "RS",
  "SI",
  "SK",
  "UA",
  "EE",
  "LV",
  "LT",
  "RU",
  "CN",
  "JP",
  "KR",
  "IN",
  "ID",
  "TH",
  "VN",
  "PH",
  "MY",
  "SG",
  "HK",
  "TW",
  "BD",
  "PK",
  "TR",
  "SA",
  "AE",
  "IL",
  "EG",
  "IR",
  "IQ",
  "QA",
  "KW",
  "AU",
  "NZ",
  "BR",
  "AR",
  "CO",
  "CL",
  "PE",
  "VE",
  "ZA",
  "NG",
  "KE",
  "MA"
] as const;

const SPECIAL_PROXY_COUNTRY_LABELS: Record<string, string> = {
  GLOBAL: "默认兜底 (GLOBAL)"
};

const proxyCountryDisplayNames =
  typeof Intl !== "undefined" && typeof Intl.DisplayNames === "function"
    ? new Intl.DisplayNames(["zh-CN", "en"], { type: "region" })
    : null;

export type ProxyCountryOption = {
  code: string;
  label: string;
};

function normalizeCountryCode(value: string) {
  return String(value || "").trim().toUpperCase();
}

export function getCountryLabel(value: string) {
  const code = normalizeCountryCode(value);
  if (!code) {
    return "未选择国家";
  }

  if (SPECIAL_PROXY_COUNTRY_LABELS[code]) {
    return SPECIAL_PROXY_COUNTRY_LABELS[code];
  }

  const displayName = proxyCountryDisplayNames?.of(code);
  if (displayName) {
    return `${displayName} (${code})`;
  }

  return `国家/地区 (${code})`;
}

export function getCountryOptions(extraCodes: string[] = []): ProxyCountryOption[] {
  const seen = new Set<string>();
  const orderedCodes = [...BASE_PROXY_COUNTRY_CODES, ...extraCodes.map(normalizeCountryCode)];

  return orderedCodes.reduce<ProxyCountryOption[]>((options, code) => {
    if (!code || code === "GLOBAL" || seen.has(code)) {
      return options;
    }

    seen.add(code);
    options.push({
      code,
      label: getCountryLabel(code)
    });
    return options;
  }, []);
}

export function getProxyCountryLabel(value: string) {
  return getCountryLabel(value);
}

export function getProxyCountryOptions(extraCodes: string[] = []): ProxyCountryOption[] {
  const seen = new Set<string>();
  const orderedCodes = ["GLOBAL", ...BASE_PROXY_COUNTRY_CODES, ...extraCodes.map(normalizeCountryCode)];

  return orderedCodes.reduce<ProxyCountryOption[]>((options, code) => {
    if (!code || seen.has(code)) {
      return options;
    }

    seen.add(code);
    options.push({
      code,
      label: getCountryLabel(code)
    });
    return options;
  }, []);
}

export function getNextProxyCountryCode(existingCodes: string[]) {
  const usedCodes = new Set(existingCodes.map(normalizeCountryCode).filter(Boolean));
  const availableOption = getProxyCountryOptions().find((option) => !usedCodes.has(option.code));
  return availableOption?.code ?? "GLOBAL";
}
