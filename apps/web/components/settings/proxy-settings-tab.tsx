import { Globe2 } from "lucide-react";

import { EmptyState } from "@autocashback/ui";

import type { ProxySettingsTabProps } from "@/components/settings/types";

export function ProxySettingsTab({
  overview,
  proxyEntries,
  proxyValidation,
  onAddProxyEntry,
  onUpdateProxyEntry,
  onRemoveProxyEntry,
  onValidateProxyEntry
}: ProxySettingsTabProps) {
  return (
    <section className="bg-card text-card-foreground rounded-xl border shadow-sm p-5" id="proxy-settings">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">代理配置</p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-foreground">按国家维护解析代理</h3>
        </div>
        <button
          className="rounded-full border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground"
          onClick={onAddProxyEntry}
          type="button"
        >
          新增代理
        </button>
      </div>

      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        按 AutoCashBack 的代理配置方式维护。每条代理绑定一个国家代码，调度器会优先选择与 Offer 国家匹配的代理，未命中时回退到
        `GLOBAL`。
      </p>

      <div className="mt-5 grid gap-3 rounded-xl border border-border bg-muted/40 p-5 text-sm text-muted-foreground lg:grid-cols-3">
        <p>活跃代理：{overview.activeProxyCount}</p>
        <p>覆盖国家/区域：{overview.configuredProxyCountries}</p>
        <p>GLOBAL 兜底：{overview.hasGlobalProxy ? "已配置" : "未配置"}</p>
      </div>

      <div className="mt-5 space-y-4">
        {proxyEntries.length ? (
          proxyEntries.map((entry, index) => (
            <div className="rounded-xl border border-border bg-muted/40 p-5" key={`${entry.label}-${index}`}>
              <div className="grid gap-4 lg:grid-cols-[140px,1fr,140px,120px]">
                <label className="block text-sm font-medium text-foreground">
                  国家
                  <input
                    className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 uppercase"
                    maxLength={12}
                    onChange={(event) =>
                      onUpdateProxyEntry(index, { country: event.target.value.toUpperCase() })
                    }
                    value={entry.country}
                  />
                </label>
                <label className="block text-sm font-medium text-foreground">
                  代理 URL
                  <input
                    className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2"
                    onChange={(event) => onUpdateProxyEntry(index, { url: event.target.value })}
                    placeholder="http://user:pass@host:port"
                    value={entry.url}
                  />
                </label>
                <label className="block text-sm font-medium text-foreground">
                  标签
                  <input
                    className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2"
                    onChange={(event) => onUpdateProxyEntry(index, { label: event.target.value })}
                    placeholder="US-main"
                    value={entry.label}
                  />
                </label>
                <label className="block text-sm font-medium text-foreground">
                  状态
                  <select
                    className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2"
                    onChange={(event) => onUpdateProxyEntry(index, { active: event.target.value === "active" })}
                    value={entry.active ? "active" : "paused"}
                  >
                    <option value="active">active</option>
                    <option value="paused">paused</option>
                  </select>
                </label>
              </div>

              <div className="mt-4 flex justify-end">
                <div className="flex flex-wrap items-center justify-end gap-3">
                  {proxyValidation[index]?.message ? (
                    <span
                      className={`text-xs ${
                        proxyValidation[index]?.status === "success"
                          ? "text-primary"
                          : proxyValidation[index]?.status === "error"
                            ? "text-destructive"
                            : "text-muted-foreground"
                      }`}
                    >
                      {proxyValidation[index]?.message}
                    </span>
                  ) : null}
                  <button
                    className="rounded-full border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground"
                    onClick={() => onValidateProxyEntry(index, entry.url)}
                    type="button"
                  >
                    验证代理
                  </button>
                  <button
                    className="rounded-full border border-destructive/20 bg-destructive/10 px-4 py-2 text-xs font-semibold text-destructive"
                    onClick={() => onRemoveProxyEntry(index)}
                    type="button"
                  >
                    删除
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <EmptyState
            className="text-left"
            description="建议至少录入一个 GLOBAL 代理，确保终链解析任务可执行。"
            icon={Globe2}
            title="还没有代理配置"
          />
        )}
      </div>
    </section>
  );
}
