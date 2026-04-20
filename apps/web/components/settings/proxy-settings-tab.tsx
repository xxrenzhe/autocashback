import { AlertCircle, CheckCircle2, Globe2, Info, Plus, Trash2 } from "lucide-react";

import { EmptyState } from "@autocashback/ui";

import type { ProxySettingsTabProps } from "@/components/settings/types";
import { getProxyCountryLabel, getProxyCountryOptions } from "@/lib/proxy-country-options";

const PROXY_FORMAT_EXAMPLES = [
  {
    title: "IPRocket",
    toneClassName: "border-sky-200 bg-sky-50/70 text-sky-700",
    badgeLabel: "推荐",
    badgeClassName: "bg-sky-100 text-sky-700",
    description: "API 格式，系统会先调用接口获取可用代理。",
    example: "https://api.iprocket.io/api?username=xxx&password=xxx&cc=US&ips=1&proxyType=http"
  },
  {
    title: "Oxylabs",
    toneClassName: "border-emerald-200 bg-emerald-50/70 text-emerald-700",
    badgeLabel: "直连",
    badgeClassName: "bg-emerald-100 text-emerald-700",
    description: "标准账号密码网关格式，适合直接连代理服务器。",
    example: "http://username:password@pr.oxylabs.io:7777"
  },
  {
    title: "Kookeey / Cliproxy",
    toneClassName: "border-violet-200 bg-violet-50/70 text-violet-700",
    badgeLabel: "兼容",
    badgeClassName: "bg-violet-100 text-violet-700",
    description: "如果供应商提供四段式配置，也可以直接填写使用。",
    example: "host:port:username:password"
  }
] as const;

export function ProxySettingsTab({
  proxyEntries,
  proxyValidation,
  onAddProxyEntry,
  onUpdateProxyEntry,
  onRemoveProxyEntry,
  onValidateProxyEntry
}: ProxySettingsTabProps) {
  const countryOptions = getProxyCountryOptions(proxyEntries.map((entry) => entry.country));
  const selectedCountries = proxyEntries.map((entry) => entry.country.trim().toUpperCase());

  return (
    <section className="rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm" id="proxy-settings">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-sm font-semibold text-foreground">代理设置</h3>
            <span className="rounded-full bg-muted px-2.5 py-1 font-mono tabular-nums text-xs text-muted-foreground">
              {proxyEntries.length}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            按国家维护代理池；未命中的请求会自动回退到 `GLOBAL` 默认代理。
          </p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground"
          onClick={onAddProxyEntry}
          type="button"
        >
          <Plus className="h-3.5 w-3.5" />
          新增代理
        </button>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)]">
        <div className="rounded-2xl border border-border bg-muted/20 p-4">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 text-primary" />
            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">代理格式说明</p>
              <p>支持 API 型和直连型代理。国家统一使用两位国家码，例如 `US`、`DE`、`JP`。</p>
              <p>第一条建议保留为 `GLOBAL`，作为没有专属国家代理时的默认兜底。</p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {PROXY_FORMAT_EXAMPLES.map((example) => (
              <div className={`rounded-xl border p-3 ${example.toneClassName}`} key={example.title}>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">{example.title}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${example.badgeClassName}`}>
                    {example.badgeLabel}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5">{example.description}</p>
                <div className="mt-3 rounded-lg bg-background/80 p-2 font-mono text-[11px] leading-5 text-foreground">
                  {example.example}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 text-amber-700" />
            <div className="space-y-2 text-sm text-amber-900">
              <p className="font-medium">填写建议</p>
              <p>国家建议一国一条，避免重复配置；新增时会自动补到下一个未使用国家。</p>
              <p>如果供应商没有 `http://` 或 `https://` 前缀，系统验证时会自动按 `http://` 补全。</p>
              <p>保存前可先点“验证代理”，确认出口 IP 正常。</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {proxyEntries.length ? (
          proxyEntries.map((entry, index) => {
            const normalizedCountry = entry.country.trim().toUpperCase();
            const countryLabel = getProxyCountryLabel(normalizedCountry);
            const validation = proxyValidation[index];

            return (
              <div className="rounded-2xl border border-border bg-muted/30 p-4" key={`${entry.label}-${index}`}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{entry.label || `代理 ${index + 1}`}</p>
                    <span className="rounded-full bg-background px-2.5 py-1 text-[11px] text-muted-foreground">
                      {countryLabel}
                    </span>
                    {normalizedCountry === "GLOBAL" ? (
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                        默认兜底
                      </span>
                    ) : null}
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        entry.active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {entry.active ? "启用中" : "已暂停"}
                    </span>
                  </div>
                  {validation?.message ? (
                    <span
                      className={`inline-flex items-center gap-1 text-xs ${
                        validation.status === "success"
                          ? "text-primary"
                          : validation.status === "error"
                            ? "text-destructive"
                            : "text-muted-foreground"
                      }`}
                    >
                      {validation.status === "success" ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                      {validation.message}
                    </span>
                  ) : null}
                </div>

                <div className="grid gap-3 lg:grid-cols-[180px,1fr,160px,140px]">
                  <label className="block text-sm font-medium text-foreground">
                    国家 / 地区
                    <select
                      className="mt-2 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                      onChange={(event) => onUpdateProxyEntry(index, { country: event.target.value.toUpperCase() })}
                      value={normalizedCountry}
                    >
                      {countryOptions.map((option) => {
                        const isDuplicate = selectedCountries.includes(option.code) && option.code !== normalizedCountry;
                        return (
                          <option disabled={isDuplicate} key={option.code} value={option.code}>
                            {option.label}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                  <label className="block text-sm font-medium text-foreground">
                    代理 URL
                    <input
                      className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2"
                      onChange={(event) => onUpdateProxyEntry(index, { url: event.target.value })}
                      placeholder="https://api.iprocket.io/... 或 http://user:pass@host:port"
                      value={entry.url}
                    />
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                      也支持 `host:port:username:password` 四段式直连格式。
                    </span>
                  </label>
                  <label className="block text-sm font-medium text-foreground">
                    标签
                    <input
                      className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2"
                      onChange={(event) => onUpdateProxyEntry(index, { label: event.target.value })}
                      placeholder={normalizedCountry === "GLOBAL" ? "global-fallback" : `${normalizedCountry.toLowerCase()}-main`}
                      value={entry.label}
                    />
                  </label>
                  <label className="block text-sm font-medium text-foreground">
                    状态
                    <select
                      className="mt-2 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                      onChange={(event) => onUpdateProxyEntry(index, { active: event.target.value === "active" })}
                      value={entry.active ? "active" : "paused"}
                    >
                      <option value="active">启用</option>
                      <option value="paused">暂停</option>
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
                      className="inline-flex items-center gap-2 rounded-full border border-destructive/20 bg-destructive/10 px-4 py-2 text-xs font-semibold text-destructive"
                      onClick={() => onRemoveProxyEntry(index)}
                      type="button"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      删除
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <EmptyState className="text-left" icon={Globe2} title="还没有代理配置" />
        )}
      </div>
    </section>
  );
}
