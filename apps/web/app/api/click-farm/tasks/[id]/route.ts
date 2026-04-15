import { NextResponse, type NextRequest } from "next/server";

import {
  deleteClickFarmTask,
  getClickFarmTaskById
} from "@autocashback/db";

import { getRequestUser } from "@/lib/api-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const task = await getClickFarmTaskById(user.id, Number(params.id));
  if (!task) {
    return NextResponse.json({ error: "补点击任务不存在" }, { status: 404 });
  }

  return NextResponse.json({ task });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const deleted = await deleteClickFarmTask(user.id, Number(params.id));
  if (!deleted) {
    return NextResponse.json({ error: "补点击任务不存在" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
