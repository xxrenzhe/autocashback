import { NextResponse, type NextRequest } from "next/server";

import { DEFAULT_SCRIPT_TEMPLATE, renderScriptTemplate } from "@autocashback/domain";
import { getOrCreateScriptToken, getSettings } from "@autocashback/db";

import { getRequestUser } from "@/lib/api-auth";

function resolveRawScriptTemplate(
  settings: Awaited<ReturnType<typeof getSettings>>
) {
  return settings.reduce((template, item) => {
    if (item.key === "script_template" && item.value) {
      return item.value;
    }

    return template;
  }, DEFAULT_SCRIPT_TEMPLATE);
}

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const [token, settings] = await Promise.all([
    getOrCreateScriptToken(user.id),
    getSettings(user.id, "linkSwap")
  ]);
  const rawTemplate = resolveRawScriptTemplate(settings);

  return NextResponse.json({
    token,
    appUrl,
    rawTemplate,
    defaultRawTemplate: DEFAULT_SCRIPT_TEMPLATE,
    template: renderScriptTemplate(rawTemplate, {
      appUrl,
      scriptToken: token
    })
  });
}
