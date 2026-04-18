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
    <section className="bg-card text-card-foreground rounded-xl border shadow-sm p-5" id="script-settings">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">换链接配置</p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-foreground">默认 MCC 脚本</h3>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            系统已经把站点地址和 Script Token 注入到脚本里。Script Token 默认长期有效，同一时间只有当前这一枚 token 生效。
            你只需要复制后粘贴到 Google Ads Scripts / MCC，并确保对应 Campaign 已绑定好 Offer 的 `campaignLabel`。
          </p>
        </div>
        <div className="rounded-xl border border-border bg-muted/40 px-3 py-2">
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Script Token</p>
          <p className="mt-2 font-mono tabular-nums text-sm text-foreground">{script.token || "尚未生成"}</p>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-border bg-muted/40 p-5 text-sm text-muted-foreground">
        {overview.scriptReady ? (
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <p>当前脚本模板和 Token 都已就绪，可以直接复制到 Google Ads Scripts / MCC 使用。</p>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
              <AlertTriangle className="h-4 w-4" />
            </span>
            <p>脚本模板或 Token 尚未生成，建议先确认基础配置和当前登录状态。</p>
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
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
        <p>复制后无需再修改脚本内容。若你更换 Token，旧 Token 会立即失效，你需要重新复制一次最新脚本。</p>
        <p>
          快照接口地址：
          <span className="font-mono tabular-nums text-xs text-foreground">
            {scriptAppUrl}/api/script/link-swap/snapshot
          </span>
        </p>
      </div>

      <textarea
        className="mt-5 min-h-72 w-full rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono tabular-nums text-xs"
        readOnly
        value={script.template}
      />
    </section>
  );
}
