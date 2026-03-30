import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";

export default async function ConsoleLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser();

  return (
    <AppShell
      user={{
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        createdAt: user.created_at
      }}
    >
      {children}
    </AppShell>
  );
}
