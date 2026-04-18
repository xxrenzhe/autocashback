export type Tone = "emerald" | "amber" | "slate" | "red";

export function getToneStyles(tone: Tone) {
  switch (tone) {
    case "emerald":
      return {
        badge: "bg-primary/10 text-primary",
        value: "text-primary",
        icon: "bg-primary/10 text-primary",
        panel: "border-emerald-200 bg-emerald-50/70"
      };
    case "amber":
      return {
        badge: "bg-amber-500/10 text-amber-600",
        value: "text-amber-600",
        icon: "bg-amber-500/10 text-amber-600",
        panel: "border-amber-200 bg-amber-500/10"
      };
    case "red":
      return {
        badge: "bg-destructive/10 text-destructive",
        value: "text-destructive",
        icon: "bg-destructive/10 text-destructive",
        panel: "border-destructive/20 bg-destructive/10"
      };
    case "slate":
    default:
      return {
        badge: "bg-slate-100 text-foreground",
        value: "text-foreground",
        icon: "bg-slate-100 text-foreground",
        panel: "border-border bg-muted/40"
      };
  }
}
