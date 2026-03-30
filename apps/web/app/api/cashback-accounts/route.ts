import { NextResponse, type NextRequest } from "next/server";

import { createAccount, deleteAccount, listAccounts, updateAccount } from "@autocashback/db";

import { getRequestUser } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ accounts: await listAccounts(user.id) });
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const account = await createAccount(user.id, body);
    return NextResponse.json({ account });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "保存失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const account = await updateAccount(user.id, Number(body.id), {
      platformCode: body.platformCode,
      accountName: body.accountName,
      registerEmail: body.registerEmail,
      payoutMethod: body.payoutMethod,
      notes: body.notes ?? "",
      status: body.status
    });
    return NextResponse.json({ account });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "更新失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const deleted = await deleteAccount(user.id, Number(body.id));

    if (!deleted) {
      return NextResponse.json({ error: "返利网账号不存在" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "删除失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
