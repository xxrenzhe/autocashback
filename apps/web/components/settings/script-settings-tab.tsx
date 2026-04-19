import { AlertTriangle, ShieldCheck } from "lucide-react";

import type { ScriptSettingsTabProps } from "@/components/settings/types";

export function ScriptSettingsTab({
  overview,
  script,
  scriptAppUrl,
  loading,
  rotatingToken,
  onRotateToken,
  onCopyScriptTemplate
}: ScriptSettingsTabProps) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm" id="script-settings">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">换链接配置</p>
          <h3 className="mt-1 text-lg font-semibold tracking-tight text-foreground">默认 MCC 脚本</h3>
        </div>
        <div className="rounded-xl border border-border bg-muted/30 px-3 py-2">
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Script Token</p>
          <p className="mt-2 font-mono tabular-nums text-sm text-foreground">{script.token || "尚未生成"}</p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        {overview.scriptReady ? (
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <p>脚本模板和 Token 已就绪。</p>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
              <AlertTriangle className="h-4 w-4" />
            </span>
            <p>脚本模板或 Token 尚未生成。</p>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          className="rounded-full border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground"
          disabled={rotatingToken}
          onClick={onRotateToken}
          type="button"
        >
          {rotatingToken ? "更换中..." : "更换 Token"}
        </button>
        <button
          className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
          disabled={loading || !script.template || rotatingToken}
          onClick={onCopyScriptTemplate}
          type="button"
        >
          复制最新换链接脚本
        </button>
      </div>

      <div className="mt-4 space-y-2 text-sm leading-6 text-muted-foreground">
        <p>
          快照接口地址：
          <span className="font-mono tabular-nums text-xs text-foreground">
            {scriptAppUrl}/api/script/link-swap/snapshot
          </span>
        </p>
      </div>

      <textarea
        className="mt-4 min-h-72 w-full rounded-lg border border-border bg-muted/30 px-3 py-2 font-mono tabular-nums text-xs"
        readOnly
        value={script.template}
      />
    </section>
  );
}
