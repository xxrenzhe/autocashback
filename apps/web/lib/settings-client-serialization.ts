type ClientSerializableSetting = {
  category: string;
  key: string;
  value: string | null | undefined;
  isSensitive?: boolean;
};

function hasClientVisibleValue(value: string | null | undefined): boolean {
  if (typeof value !== "string") {
    return Boolean(value);
  }

  return value.trim().length > 0;
}

export function serializeSettingForClient(setting: ClientSerializableSetting) {
  return {
    category: setting.category,
    key: setting.key,
    value: setting.isSensitive ? null : setting.value ?? "",
    hasValue: hasClientVisibleValue(setting.value),
    isSensitive: Boolean(setting.isSensitive)
  };
}
