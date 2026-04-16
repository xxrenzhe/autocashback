import { requireAdmin } from "@/lib/auth";
import { QueueMonitor } from "@/components/queue-monitor";

export default async function QueuePage() {
  await requireAdmin();
  return <QueueMonitor />;
}
