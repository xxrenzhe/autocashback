import { NextRequest, NextResponse } from "next/server";

import {
  changeUserPassword,
  createUserSession,
  getAuthCookieName,
  logAuditEvent,
  revokeAllUserSessions
} from "@autocashback/db";

import { getRequestAuth } from "@/lib/api-auth";
import { getRequestMetadata } from "@/lib/request-metadata";

function validatePasswordStrength(password: string) {
  const errors: string[] = [];

  if (password.length < 10) {
    errors.push("密码至少需要 10 个字符");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("密码至少需要 1 个大写字母");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("密码至少需要 1 个小写字母");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("密码至少需要 1 个数字");
  }

  return errors;
}

export async function POST(request: NextRequest) {
  const auth = await getRequestAuth(request);
  if (!auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const currentPassword = String(body.currentPassword || "");
  const newPassword = String(body.newPassword || "");
  const confirmPassword = String(body.confirmPassword || "");

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "当前密码和新密码不能为空" }, { status: 400 });
  }
  if (newPassword !== confirmPassword) {
    return NextResponse.json({ error: "两次输入的新密码不一致" }, { status: 400 });
  }

  const errors = validatePasswordStrength(newPassword);
  if (errors.length) {
    return NextResponse.json({ error: errors[0], details: errors }, { status: 400 });
  }

  try {
    await changeUserPassword({
      userId: auth.user.id,
      currentPassword,
      newPassword
    });
    await revokeAllUserSessions(auth.user.id);

    const metadata = getRequestMetadata(request);
    const session = await createUserSession(auth.user.id, auth.user.role, metadata);
    await logAuditEvent({
      userId: auth.user.id,
      eventType: "password_changed",
      ...metadata,
      details: {
        sessionRotation: true
      }
    });

    const response = NextResponse.json({
      success: true,
      message: "密码已更新，其他会话已全部退出"
    });
    response.cookies.set(getAuthCookieName(), session.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7
    });
    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "修改密码失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
