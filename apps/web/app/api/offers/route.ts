import { NextResponse, type NextRequest } from "next/server";

import { createOffer, listAccounts, listOffers } from "@autocashback/db";

import { getRequestUser } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ offers: await listOffers(user.id) });
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const accounts = await listAccounts(user.id);
    const matchedAccount = accounts.find((account) => account.id === body.cashbackAccountId);

    if (!matchedAccount) {
      return NextResponse.json({ error: "返利网账号不存在" }, { status: 400 });
    }

    const offer = await createOffer(user.id, body);
    return NextResponse.json({ offer });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "创建失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
