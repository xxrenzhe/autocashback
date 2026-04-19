import type { GoogleAdsSettingsTabProps } from "@/components/settings/types";

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
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-sm font-semibold text-foreground">Google Ads 凭证</h3>
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
            {googleAdsConfig.hasRefreshToken ? "oauth" : "setup"}
          </span>
        </div>
        <button
          className="rounded-full border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground"
          onClick={onOpenGoogleAdsPage}
          type="button"
        >
          打开账号页
        </button>
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
        <label className="block text-sm font-medium text-foreground">
          Client ID
          <input
            className="mt-2 w-full rounded-lg border border-border bg-muted/40 px-3 py-2"
            onChange={(event) => onGoogleAdsConfigChange({ clientId: event.target.value })}
            placeholder={
              googleAdsConfig.hasClientId ? "已配置，留空表示保持不变" : "Google OAuth Client ID"
            }
            value={googleAdsConfig.clientId}
          />
        </label>

        <label className="block text-sm font-medium text-foreground">
          Client Secret
          <input
            className="mt-2 w-full rounded-lg border border-border bg-muted/40 px-3 py-2"
            onChange={(event) => onGoogleAdsConfigChange({ clientSecret: event.target.value })}
            placeholder={
              googleAdsConfig.hasClientSecret ? "已配置，留空表示保持不变" : "Google OAuth Client Secret"
            }
            value={googleAdsConfig.clientSecret}
          />
        </label>

        <label className="block text-sm font-medium text-foreground">
          Developer Token
          <input
            className="mt-2 w-full rounded-lg border border-border bg-muted/40 px-3 py-2"
            onChange={(event) => onGoogleAdsConfigChange({ developerToken: event.target.value })}
            placeholder={
              googleAdsConfig.hasDeveloperToken
                ? "已配置，留空表示保持不变"
                : "Google Ads Developer Token"
            }
            value={googleAdsConfig.developerToken}
          />
        </label>

        <label className="block text-sm font-medium text-foreground">
          Login Customer ID
          <input
            className="mt-2 w-full rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono tabular-nums"
            onChange={(event) => onGoogleAdsConfigChange({ loginCustomerId: event.target.value })}
            placeholder="1234567890"
            value={googleAdsConfig.loginCustomerId}
          />
        </label>
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
          <dd className="mt-1 font-medium text-foreground">{googleAdsConfig.hasRefreshToken ? "已获取" : "未授权"}</dd>
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
