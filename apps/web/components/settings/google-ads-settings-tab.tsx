import { ExternalLink, Info, KeyRound, ShieldCheck } from "lucide-react";

import type { GoogleAdsSettingsTabProps } from "@/components/settings/types";

const GOOGLE_ADS_DOC_LINKS = {
  setupGuide: "https://developers.google.com/google-ads/api/docs/get-started/introduction",
  oauthProject: "https://developers.google.com/google-ads/api/docs/get-started/oauth-cloud-project",
  credentialsConsole: "https://console.cloud.google.com/apis/credentials",
  developerTokenGuide: "https://developers.google.com/google-ads/api/docs/get-started/dev-token",
  apiCenter: "https://ads.google.com/aw/apicenter",
  authGuide: "https://developers.google.com/google-ads/api/rest/auth",
  customerIdGuide: "https://support.google.com/google-ads/answer/1704344"
} as const;

const QUICK_LINKS = [
  { label: "Google Ads API 指南", href: GOOGLE_ADS_DOC_LINKS.setupGuide },
  { label: "Google Cloud 凭证页", href: GOOGLE_ADS_DOC_LINKS.credentialsConsole },
  { label: "API Center", href: GOOGLE_ADS_DOC_LINKS.apiCenter }
] as const;

const FIELD_HELP = {
  clientId: {
    description: "在 Google Cloud Console 的 APIs & Services > Credentials 中创建 OAuth Client 后获得。",
    href: GOOGLE_ADS_DOC_LINKS.oauthProject,
    linkLabel: "查看 Cloud OAuth 配置"
  },
  clientSecret: {
    description: "与 Client ID 配对生成，同样来自 Google Cloud Console 的 OAuth Client。",
    href: GOOGLE_ADS_DOC_LINKS.credentialsConsole,
    linkLabel: "打开 Credentials"
  },
  developerToken: {
    description: "在 MCC 或可管理账号的 API Center 申请/复制，通常需要 Explorer 及以上权限。",
    href: GOOGLE_ADS_DOC_LINKS.developerTokenGuide,
    linkLabel: "查看 Developer Token 说明"
  },
  loginCustomerId: {
    description: "填写你的管理账号 Customer ID，使用 10 位纯数字，不带中划线。",
    href: GOOGLE_ADS_DOC_LINKS.authGuide,
    linkLabel: "查看 Login Customer ID 说明"
  }
} as const;

function ExternalDocLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      href={href}
      rel="noreferrer"
      target="_blank"
    >
      {label}
      <ExternalLink className="h-3.5 w-3.5" />
    </a>
  );
}

function FieldShell({
  label,
  description,
  href,
  linkLabel,
  children
}: {
  label: string;
  description: string;
  href: string;
  linkLabel: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-medium text-foreground">
      <div className="flex items-center justify-between gap-3">
        <span>{label}</span>
        <ExternalDocLink href={href} label={linkLabel} />
      </div>
      <span className="mt-1 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {description}
      </span>
      {children}
    </label>
  );
}

export function GoogleAdsSettingsTab({
  overview,
  googleAdsConfig,
  onGoogleAdsConfigChange,
  onOpenGoogleAdsPage,
  onSaveGoogleAdsConfig,
  onAuthorizeGoogleAds,
  onVerifyGoogleAdsConfig,
  onClearGoogleAdsConfig
}: GoogleAdsSettingsTabProps) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm" id="google-ads-settings">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-sm font-semibold text-foreground">Google Ads 凭证</h3>
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
              {googleAdsConfig.hasRefreshToken ? "oauth" : "setup"}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            先配基础参数，再发起 OAuth 授权；Refresh Token 会在授权完成后自动写入。
          </p>
        </div>
        <button
          className="rounded-full border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground"
          onClick={onOpenGoogleAdsPage}
          type="button"
        >
          打开账号页
        </button>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)]">
        <div className="rounded-2xl border border-border bg-muted/20 p-4">
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" />
            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">推荐配置顺序</p>
              <p>1. 在 Google Cloud Console 创建 OAuth Client，拿到 Client ID / Client Secret。</p>
              <p>2. 在 Google Ads API Center 申请或复制 Developer Token。</p>
              <p>3. 填写 Login Customer ID，也就是你要作为管理入口的 Google Ads 客户号。</p>
              <p>4. 保存基础参数后点击“发起 OAuth 授权”，系统会自动换取 Refresh Token。</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {QUICK_LINKS.map((item) => (
              <a
                className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                href={item.href}
                key={item.label}
                rel="noreferrer"
                target="_blank"
              >
                {item.label}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
          <div className="flex items-start gap-2">
            <KeyRound className="mt-0.5 h-4 w-4 text-amber-700" />
            <div className="space-y-2 text-sm text-amber-900">
              <p className="font-medium">参数获取提示</p>
              <p>Client ID 和 Client Secret 必须来自同一个 Google Cloud OAuth Client。</p>
              <p>Developer Token 建议在 MCC 账号下获取，便于统一管理多个投放账户。</p>
              <p>Login Customer ID 填管理账号 ID；格式是 10 位数字，例如 `1234567890`。</p>
              <div className="pt-1">
                <ExternalDocLink href={GOOGLE_ADS_DOC_LINKS.customerIdGuide} label="如何查看 Google Ads Customer ID" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <dl className="mt-4 grid gap-3 rounded-xl border border-border bg-muted/30 p-4 text-sm lg:grid-cols-3">
        <div>
          <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">基础项</dt>
          <dd className="mt-1 font-medium text-foreground">{overview.googleAdsBaseConfigCount} / 4</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">OAuth</dt>
          <dd className="mt-1 font-medium text-foreground">{googleAdsConfig.hasRefreshToken ? "已授权" : "未授权"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">最近验证</dt>
          <dd className="mt-1 font-medium text-foreground">{googleAdsConfig.lastVerifiedAt || "--"}</dd>
        </div>
      </dl>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <FieldShell {...FIELD_HELP.clientId} label="Client ID">
          <input
            className="mt-2 w-full rounded-lg border border-border bg-muted/40 px-3 py-2"
            onChange={(event) => onGoogleAdsConfigChange({ clientId: event.target.value })}
            placeholder={googleAdsConfig.hasClientId ? "已配置，留空表示保持不变" : "Google OAuth Client ID"}
            value={googleAdsConfig.clientId}
          />
        </FieldShell>

        <FieldShell {...FIELD_HELP.clientSecret} label="Client Secret">
          <input
            className="mt-2 w-full rounded-lg border border-border bg-muted/40 px-3 py-2"
            onChange={(event) => onGoogleAdsConfigChange({ clientSecret: event.target.value })}
            placeholder={
              googleAdsConfig.hasClientSecret ? "已配置，留空表示保持不变" : "Google OAuth Client Secret"
            }
            value={googleAdsConfig.clientSecret}
          />
        </FieldShell>

        <FieldShell {...FIELD_HELP.developerToken} label="Developer Token">
          <input
            className="mt-2 w-full rounded-lg border border-border bg-muted/40 px-3 py-2"
            onChange={(event) => onGoogleAdsConfigChange({ developerToken: event.target.value })}
            placeholder={
              googleAdsConfig.hasDeveloperToken ? "已配置，留空表示保持不变" : "Google Ads Developer Token"
            }
            value={googleAdsConfig.developerToken}
          />
        </FieldShell>

        <FieldShell {...FIELD_HELP.loginCustomerId} label="Login Customer ID">
          <input
            className="mt-2 w-full rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono tabular-nums"
            onChange={(event) => onGoogleAdsConfigChange({ loginCustomerId: event.target.value })}
            placeholder="1234567890"
            value={googleAdsConfig.loginCustomerId}
          />
        </FieldShell>
      </div>

      <dl className="mt-4 grid gap-3 rounded-xl border border-border bg-muted/30 p-4 text-sm lg:grid-cols-3">
        <div>
          <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Client ID</dt>
          <dd className="mt-1 font-medium text-foreground">{googleAdsConfig.hasClientId ? "已保存" : "未配置"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Client Secret</dt>
          <dd className="mt-1 font-medium text-foreground">
            {googleAdsConfig.hasClientSecret ? "已保存" : "未配置"}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Developer Token</dt>
          <dd className="mt-1 font-medium text-foreground">
            {googleAdsConfig.hasDeveloperToken ? "已保存" : "未配置"}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Refresh Token</dt>
          <dd className="mt-1 font-medium text-foreground">{googleAdsConfig.hasRefreshToken ? "已获取" : "等待 OAuth"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">最近验证</dt>
          <dd className="mt-1 font-medium text-foreground">{googleAdsConfig.lastVerifiedAt || "--"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Token 过期</dt>
          <dd className="mt-1 font-medium text-foreground">{googleAdsConfig.tokenExpiresAt || "--"}</dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
          onClick={onSaveGoogleAdsConfig}
          type="button"
        >
          保存 Google Ads 配置
        </button>
        <button
          className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground"
          onClick={onAuthorizeGoogleAds}
          type="button"
        >
          发起 OAuth 授权
        </button>
        <button
          className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground"
          onClick={onVerifyGoogleAdsConfig}
          type="button"
        >
          验证并同步
        </button>
        <button
          className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-2 text-sm font-semibold text-destructive"
          onClick={onClearGoogleAdsConfig}
          type="button"
        >
          清除配置
        </button>
      </div>
    </section>
  );
}
