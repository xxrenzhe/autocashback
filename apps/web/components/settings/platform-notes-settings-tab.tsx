import type { PlatformNotesSettingsTabProps } from "@/components/settings/types";

export function PlatformNotesSettingsTab({
  overview,
  platformNotes,
  onPlatformNoteChange
}: PlatformNotesSettingsTabProps) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm" id="platform-settings">
      <p className="text-xs font-semibold uppercase tracking-wider text-primary">返利网配置</p>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold tracking-tight text-foreground">平台接入策略</h3>
        <span className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-semibold text-muted-foreground">
          已填写 {overview.noteCount}/3
        </span>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <label className="rounded-xl border border-border bg-muted/30 p-4 text-sm font-medium text-foreground">
          TopCashback
          <textarea
            className="mt-3 min-h-36 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal"
            onChange={(event) => onPlatformNoteChange("topcashback", event.target.value)}
            value={platformNotes.topcashback}
          />
        </label>
        <label className="rounded-xl border border-border bg-muted/30 p-4 text-sm font-medium text-foreground">
          Rakuten
          <textarea
            className="mt-3 min-h-36 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal"
            onChange={(event) => onPlatformNoteChange("rakuten", event.target.value)}
            value={platformNotes.rakuten}
          />
        </label>
        <label className="rounded-xl border border-border bg-muted/30 p-4 text-sm font-medium text-foreground">
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
