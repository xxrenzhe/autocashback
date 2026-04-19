import { Globe2 } from "lucide-react";

import { EmptyState } from "@autocashback/ui";

import type { ProxySettingsTabProps } from "@/components/settings/types";

export function ProxySettingsTab({
  proxyEntries,
  proxyValidation,
  onAddProxyEntry,
  onUpdateProxyEntry,
  onRemoveProxyEntry,
  onValidateProxyEntry
}: ProxySettingsTabProps) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm" id="proxy-settings">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-sm font-semibold text-foreground">代理</h3>
          <span className="rounded-full bg-muted px-2.5 py-1 font-mono tabular-nums text-xs text-muted-foreground">
            {proxyEntries.length}
          </span>
        </div>
        <button
          className="rounded-full border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground"
          onClick={onAddProxyEntry}
          type="button"
        >
          新增代理
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {proxyEntries.length ? (
          proxyEntries.map((entry, index) => (
            <div className="rounded-xl border border-border bg-muted/30 p-4" key={`${entry.label}-${index}`}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{entry.label || `Proxy ${index + 1}`}</p>
                  <span className="rounded-full bg-background px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
                    {entry.country}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      entry.active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {entry.active ? "active" : "paused"}
                  </span>
                </div>
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
              </div>

              <div className="grid gap-3 lg:grid-cols-[140px,1fr,140px,120px]">
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

              <div className="mt-3 flex justify-end">
                <div className="flex flex-wrap items-center justify-end gap-3">
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
          <EmptyState className="text-left" icon={Globe2} title="还没有代理配置" />
        )}
      </div>
    </section>
  );
}
