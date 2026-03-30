import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getAuthCookieName, getCurrentUser } from "@autocashback/db";

export async function requireUser() {
  const token = cookies().get(getAuthCookieName())?.value;
  const user = await getCurrentUser(token);

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") {
    redirect("/dashboard");
  }
  return user;
}
