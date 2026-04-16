import { NextResponse, type NextRequest } from "next/server";

import { logAuditEvent, resetUserPasswordByAdmin } from "@autocashback/db";

import { getRequestUser } from "@/lib/api-auth";
import { getRequestMetadata } from "@/lib/request-metadata";

export async function POST(
  request: NextRequest,
  context: { params: { id: string } }
) {
  const currentUser = await getRequestUser(request);
  if (!currentUser || currentUser.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userId = Number(context.params.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new Error("用户不存在");
    }

    const result = await resetUserPasswordByAdmin(userId);

    await logAuditEvent({
      userId: currentUser.id,
      eventType: "user_password_reset",
      ...getRequestMetadata(request),
      details: {
        targetUserId: userId,
        targetUsername: result.username
      }
    });

    return NextResponse.json({
      username: result.username,
      newPassword: result.password
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "密码重置失败" },
      { status: 400 }
    );
  }
}
