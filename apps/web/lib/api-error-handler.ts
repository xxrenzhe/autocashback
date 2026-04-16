export type ApiErrorResult = {
  success: false;
  status: number;
  error: string;
  userMessage: string;
};

export type ApiSuccessResult<T> = {
  success: true;
  status: number;
  data: T;
};

export type ApiResult<T> = ApiSuccessResult<T> | ApiErrorResult;

function normalizeTextMessage(text: string, status: number) {
  if (
    text.includes("no healthy upstream") ||
    text.includes("502 Bad Gateway") ||
    text.includes("503 Service Unavailable")
  ) {
    return {
      error: "SERVICE_UNAVAILABLE",
      userMessage: "服务暂时不可用，请稍后重试"
    };
  }

  if (text.includes("<!DOCTYPE") || text.includes("<html")) {
    return {
      error: "HTML_RESPONSE",
      userMessage: `服务返回了异常页面 (${status})`
    };
  }

  return {
    error: "UNKNOWN_ERROR",
    userMessage: status >= 500 ? "服务异常，请稍后重试" : `请求失败 (${status})`
  };
}

export async function safeJsonParse<T>(response: Response): Promise<ApiResult<T>> {
  const status = response.status;
  const text = await response.text();

  if (!text.trim()) {
    return response.ok
      ? {
          success: false,
          status,
          error: "EMPTY_RESPONSE",
          userMessage: "服务返回空响应"
        }
      : {
          success: false,
          status,
          error: "EMPTY_ERROR_RESPONSE",
          userMessage: `请求失败 (${status})`
        };
  }

  try {
    const data = JSON.parse(text) as T & { error?: unknown; message?: unknown };
    if (!response.ok) {
      return {
        success: false,
        status,
        error: typeof data.error === "string" ? data.error : "API_ERROR",
        userMessage:
          typeof data.error === "string"
            ? data.error
            : typeof data.message === "string"
              ? data.message
              : `请求失败 (${status})`
      };
    }

    return {
      success: true,
      status,
      data
    };
  } catch {
    const normalized = normalizeTextMessage(text, status);
    return {
      success: false,
      status,
      error: normalized.error,
      userMessage: normalized.userMessage
    };
  }
}

export async function fetchJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
  retryConfig?: {
    maxRetries?: number;
    retryDelayMs?: number;
  }
): Promise<ApiResult<T>> {
  const maxRetries = Math.max(0, Number(retryConfig?.maxRetries ?? 1));
  const retryDelayMs = Math.max(100, Number(retryConfig?.retryDelayMs ?? 800));

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const result = await safeJsonParse<T>(await fetch(input, init));
      if (result.success) {
        return result;
      }

      if (
        attempt < maxRetries &&
        (result.error === "SERVICE_UNAVAILABLE" ||
          result.error === "NETWORK_ERROR" ||
          result.error === "HTML_RESPONSE")
      ) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs * (attempt + 1)));
        continue;
      }

      return result;
    } catch {
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs * (attempt + 1)));
        continue;
      }
    }
  }

  return {
    success: false,
    status: 0,
    error: "NETWORK_ERROR",
    userMessage: "网络异常，请稍后重试"
  };
}
