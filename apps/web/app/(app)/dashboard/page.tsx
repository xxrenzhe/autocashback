import { DashboardClientPage } from "@/components/dashboard-client-page";
import { requireUser } from "@/lib/auth";

export default async function DashboardPage() {
  const user = await requireUser();
  return <DashboardClientPage username={user.username} />;
}
