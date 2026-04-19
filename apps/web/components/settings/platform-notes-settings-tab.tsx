import type { PlatformNotesSettingsTabProps } from "@/components/settings/types";

export function PlatformNotesSettingsTab({
  overview,
  platformNotes,
  onPlatformNoteChange
}: PlatformNotesSettingsTabProps) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm" id="platform-settings">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">平台备注</h3>
        <span className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-semibold text-muted-foreground">
          已填写 {overview.noteCount}/3
        </span>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <label className="rounded-xl border border-border bg-muted/30 p-4 text-sm font-medium text-foreground">
          <span className="block text-sm font-semibold text-foreground">TopCashback</span>
          <textarea
            className="mt-3 min-h-36 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal"
            onChange={(event) => onPlatformNoteChange("topcashback", event.target.value)}
            value={platformNotes.topcashback}
          />
        </label>
        <label className="rounded-xl border border-border bg-muted/30 p-4 text-sm font-medium text-foreground">
          <span className="block text-sm font-semibold text-foreground">Rakuten</span>
          <textarea
            className="mt-3 min-h-36 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal"
            onChange={(event) => onPlatformNoteChange("rakuten", event.target.value)}
            value={platformNotes.rakuten}
          />
        </label>
        <label className="rounded-xl border border-border bg-muted/30 p-4 text-sm font-medium text-foreground">
          <span className="block text-sm font-semibold text-foreground">Custom</span>
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
