import type { PlatformNotesSettingsTabProps } from "@/components/settings/types";

export function PlatformNotesSettingsTab({
  overview,
  platformNotes,
  onPlatformNoteChange
}: PlatformNotesSettingsTabProps) {
  return (
    <section className="bg-card text-card-foreground rounded-xl border shadow-sm p-5" id="platform-settings">
      <p className="text-xs font-semibold uppercase tracking-wider text-primary">返利网配置</p>
      <h3 className="mt-2 text-xl font-semibold tracking-tight text-foreground">平台接入策略</h3>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        在这里维护各返利平台的运营说明、登录入口和处理规范，方便团队统一查看和协作。
      </p>

      <div className="mt-5 rounded-xl border border-border bg-muted/40 p-5 text-sm text-muted-foreground">
        当前已填写 {overview.noteCount} / 3 份平台说明。建议至少补齐 TopCashback、Rakuten 和 Custom 的登录入口、风控点和操作规范。
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <label className="rounded-xl border border-border bg-muted/40 p-5 text-sm font-medium text-foreground">
          TopCashback
          <textarea
            className="mt-3 min-h-36 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal"
            onChange={(event) => onPlatformNoteChange("topcashback", event.target.value)}
            value={platformNotes.topcashback}
          />
        </label>
        <label className="rounded-xl border border-border bg-muted/40 p-5 text-sm font-medium text-foreground">
          Rakuten
          <textarea
            className="mt-3 min-h-36 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal"
            onChange={(event) => onPlatformNoteChange("rakuten", event.target.value)}
            value={platformNotes.rakuten}
          />
        </label>
        <label className="rounded-xl border border-border bg-muted/40 p-5 text-sm font-medium text-foreground">
          Custom
          <textarea
            className="mt-3 min-h-36 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal"
            onChange={(event) => onPlatformNoteChange("custom", event.target.value)}
            value={platformNotes.custom}
          />
        </label>
      </div>
    </section>
  );
}
