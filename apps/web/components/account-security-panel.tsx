"use client";

import { formatDateTime } from "@/lib/format";

import { useEffect, useState } from "react";

import { fetchJson } from "@/lib/api-error-handler";

type SessionRecord = {
  sessionId: string;
  ipAddress: string | null;
  userAgent: string | null;
  isCurrent: boolean;
  createdAt: string;
  lastActivityAt: string;
  expiresAt: string;
};



export function AccountSecurityPanel() {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [changingPassword, setChangingPassword] = useState(false);
  
  async function loadSessions() {
    setLoading(true);
    const result = await fetchJson<{ sessions: SessionRecord[] }>("/api/auth/sessions");
    if (result.success) {
      setSessions(result.data.sessions || []);
          } else {
      setMessage(result.userMessage);
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadSessions();
  }, []);

  async function changePassword() {
    setChangingPassword(true);
    const result = await fetchJson<{ message?: string }>("/api/auth/change-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        currentPassword,
        newPassword,
        confirmPassword
      })
    });

    if (result.success) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage(result.data.message || "密码已更新");
      await loadSessions();
    } else {
      setMessage(result.userMessage);
    }
    setChangingPassword(false);
  }

  async function revokeSession(sessionId: string, revokeAll = false) {
    const result = await fetchJson<{ clearCurrentSession?: boolean; message?: string }>(
      "/api/auth/sessions",
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(
          revokeAll
            ? {
                revokeAll: true
              }
            : {
                sessionId
              }
        )
      }
    );

    if (!result.success) {
      setMessage(result.userMessage);
      return;
    }

    if (result.data.clearCurrentSession) {
      window.location.href = "/login";
      return;
    }

    setMessage(result.data.message || "会话已撤销");
    await loadSessions();
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">账户安全</p>
          <h3 className="mt-1 text-lg font-semibold tracking-tight text-foreground">密码与登录会话</h3>
        </div>
        <button
          className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-2 text-sm font-semibold text-destructive"
          onClick={() => revokeSession("", true)}
          type="button"
        >
          撤销全部会话
        </button>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[0.8fr,1.2fr]">
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <p className="text-sm font-semibold text-foreground">修改密码</p>
          <div className="mt-4 space-y-4">
            <label className="block text-sm text-foreground">
              当前密码
              <input
                className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2"
                onChange={(event) => setCurrentPassword(event.target.value)}
                type="password"
                value={currentPassword}
              />
            </label>
            <label className="block text-sm text-foreground">
              新密码
              <input
                className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2"
                onChange={(event) => setNewPassword(event.target.value)}
                type="password"
                value={newPassword}
              />
            </label>
            <label className="block text-sm text-foreground">
              确认新密码
              <input
                className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2"
                onChange={(event) => setConfirmPassword(event.target.value)}
                type="password"
                value={confirmPassword}
              />
            </label>
          </div>
          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            新密码至少 10 位，并包含大小写字母和数字。修改成功后，旧会话会全部失效。
          </p>
          <button
            className="mt-5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            disabled={changingPassword}
            onClick={changePassword}
            type="button"
          >
            {changingPassword ? "提交中..." : "更新密码"}
          </button>
        </div>

        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-semibold text-foreground">活跃会话</p>
            <button
              className="rounded-full border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground"
              onClick={loadSessions}
              type="button"
            >
              刷新
            </button>
          </div>

          <div className="mt-4 grid gap-3">
            {loading ? (
              <p className="rounded-lg bg-background px-4 py-5 text-sm text-muted-foreground">正在加载会话...</p>
            ) : sessions.length ? (
              sessions.map((session) => (
                <div className="rounded-lg border border-border bg-background p-4" key={session.sessionId}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {session.isCurrent ? "当前设备" : "其他设备"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{session.ipAddress || "未知 IP"}</p>
                      <p className="mt-1 break-all text-xs text-muted-foreground">
                        {session.userAgent || "未知 User-Agent"}
                      </p>
                    </div>
                    <button
                      className="rounded-full border border-destructive/20 bg-destructive/10 px-4 py-2 text-xs font-semibold text-destructive"
                      onClick={() => revokeSession(session.sessionId)}
                      type="button"
                    >
                      {session.isCurrent ? "退出当前会话" : "撤销会话"}
                    </button>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                    <p>创建时间：{formatDateTime(session.createdAt)}</p>
                    <p>最近活动：{formatDateTime(session.lastActivityAt)}</p>
                    <p>过期时间：{formatDateTime(session.expiresAt)}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="rounded-lg bg-background px-4 py-5 text-sm text-muted-foreground">暂无活跃会话。</p>
            )}
          </div>
        </div>
      </div>

      {message ? <p className="mt-4 text-sm text-muted-foreground">{message}</p> : null}
    </section>
  );
}
