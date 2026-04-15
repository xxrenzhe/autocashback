import { NextResponse, type NextRequest } from "next/server";

import { restartClickFarmTask } from "@autocashback/db";

import { getRequestUser } from "@/lib/api-auth";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json({
      task: await restartClickFarmTask(user.id, Number(params.id))
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "恢复补点击任务失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
