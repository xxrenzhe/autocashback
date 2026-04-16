import { NextResponse, type NextRequest } from "next/server";

import { getLinkSwapTaskByOfferId } from "@autocashback/db";

import { getRequestUser } from "@/lib/api-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const offerId = Number(params.id);
  if (!Number.isFinite(offerId)) {
    return NextResponse.json({ error: "无效的 Offer ID" }, { status: 400 });
  }

  const task = await getLinkSwapTaskByOfferId(user.id, offerId);

  return NextResponse.json({
    success: true,
    data: task,
    task,
    message: task ? "已找到换链接任务" : "该 Offer 没有关联的换链接任务"
  });
}
