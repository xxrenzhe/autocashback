import { AdminUsersManager } from "@/components/admin-users-manager";
import { requireAdmin } from "@/lib/auth";

export default async function AdminUsersPage() {
  await requireAdmin();
  return <AdminUsersManager />;
}
