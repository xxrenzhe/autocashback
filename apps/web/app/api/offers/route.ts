import { NextResponse, type NextRequest } from "next/server";

import { createOffer, deleteOffer, listAccounts, listOffers, updateOffer } from "@autocashback/db";

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

    const offer = await createOffer(user.id, {
      platformCode: body.platformCode,
      cashbackAccountId: Number(body.cashbackAccountId),
      promoLink: body.promoLink,
      targetCountry: String(body.targetCountry || "").toUpperCase(),
      brandName: body.brandName,
      campaignLabel: body.campaignLabel,
      commissionCapUsd: Number(body.commissionCapUsd),
      manualRecordedCommissionUsd: Number(body.manualRecordedCommissionUsd)
    });
    return NextResponse.json({ offer });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "创建失败";
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
    const accounts = await listAccounts(user.id);
    const matchedAccount = accounts.find((account) => account.id === Number(body.cashbackAccountId));

    if (!matchedAccount) {
      return NextResponse.json({ error: "返利网账号不存在" }, { status: 400 });
    }

    const offer = await updateOffer(user.id, Number(body.id), {
      platformCode: body.platformCode,
      cashbackAccountId: Number(body.cashbackAccountId),
      promoLink: body.promoLink,
      targetCountry: String(body.targetCountry || "").toUpperCase(),
      brandName: body.brandName,
      campaignLabel: body.campaignLabel,
      commissionCapUsd: Number(body.commissionCapUsd),
      manualRecordedCommissionUsd: Number(body.manualRecordedCommissionUsd)
    });
    return NextResponse.json({ offer });
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
    const deleted = await deleteOffer(user.id, Number(body.id));

    if (!deleted) {
      return NextResponse.json({ error: "Offer 不存在" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "删除失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
