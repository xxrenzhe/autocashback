import { NextResponse, type NextRequest } from "next/server";

import {
  deleteUserByAdmin,
  logAuditEvent,
  updateUserByAdmin
} from "@autocashback/db";

import { getRequestUser } from "@/lib/api-auth";
import { getRequestMetadata } from "@/lib/request-metadata";

function parseUserId(value: string) {
  const userId = Number(value);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error("用户不存在");
  }
  return userId;
}

export async function PATCH(
  request: NextRequest,
  context: { params: { id: string } }
) {
  const currentUser = await getRequestUser(request);
  if (!currentUser || currentUser.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userId = parseUserId(context.params.id);
    const body = (await request.json().catch(() => ({}))) as {
      email?: string;
      role?: "admin" | "user";
    };
    const updated = await updateUserByAdmin(userId, {
      email: typeof body.email === "string" ? body.email.trim() : undefined,
      role: body.role === "admin" || body.role === "user" ? body.role : undefined
    });

    await logAuditEvent({
      userId: currentUser.id,
      eventType: "user_updated",
      ...getRequestMetadata(request),
      details: {
        updatedUserId: updated.id,
        updatedUsername: updated.username,
        updatedRole: updated.role
      }
    });

    return NextResponse.json({ user: updated });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "更新失败" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: { id: string } }
) {
  const currentUser = await getRequestUser(request);
  if (!currentUser || currentUser.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userId = parseUserId(context.params.id);
    if (userId === currentUser.id) {
      throw new Error("不能删除当前登录账号");
    }

    const deleted = await deleteUserByAdmin(userId);

    await logAuditEvent({
      userId: currentUser.id,
      eventType: "user_deleted",
      ...getRequestMetadata(request),
      details: {
        deletedUserId: deleted.id,
        deletedUsername: deleted.username,
        deletedRole: deleted.role
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "删除失败" },
      { status: 400 }
    );
  }
}
