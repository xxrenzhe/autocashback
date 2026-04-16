"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  Copy,
  History,
  KeyRound,
  PencilLine,
  Plus,
  RefreshCcw,
  Search,
  ShieldAlert,
  Trash2
} from "lucide-react";

import { fetchJson } from "@/lib/api-error-handler";
import { ModalFrame } from "@/components/modal-frame";

type AdminUser = {
  id: number;
  username: string;
  email: string;
  role: "admin" | "user";
  createdAt: string;
  lastLoginAt: string | null;
  activeSessionCount: number;
  isActive: boolean;
  lockedUntil: string | null;
  failedLoginCount: number;
};

type Pagination = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type LoginRecord = {
  sessionId: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  lastActivityAt: string;
  expiresAt: string;
  revokedAt: string | null;
  status: "active" | "expired" | "revoked";
};

type SortField = "id" | "username" | "email" | "role" | "createdAt" | "lastLoginAt";
type SortDirection = "asc" | "desc";
type AdminUsersQuery = {
  page?: number;
  limit?: number;
  searchQuery?: string;
  roleFilter?: "all" | "admin" | "user";
  sortField?: SortField;
  sortDirection?: SortDirection;
};

const ANIMALS = [
  "wolf",
  "eagle",
  "tiger",
  "lion",
  "bear",
  "fox",
  "hawk",
  "owl",
  "otter",
  "falcon"
];

const ADJECTIVES = [
  "bold",
  "swift",
  "wise",
  "brave",
  "keen",
  "noble",
  "steady",
  "fierce",
  "calm",
  "agile"
];

const initialCreateForm = {
  username: "",
  email: "",
  password: "",
  role: "user" as "admin" | "user"
};

async function requestAdminUsers(input: AdminUsersQuery) {
  const params = new URLSearchParams({
    page: String(input.page || 1),
    limit: String(input.limit || 10),
    search: input.searchQuery ?? "",
    role: input.roleFilter ?? "all",
    sortBy: input.sortField ?? "createdAt",
    sortOrder: input.sortDirection ?? "desc"
  });

  return fetchJson<{
    users: AdminUser[];
    pagination: Pagination;
  }>(`/api/admin/users?${params.toString()}`, { cache: "no-store" });
}

export function AdminUsersManager() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1
  });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "user">("all");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [createForm, setCreateForm] = useState(initialCreateForm);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [editForm, setEditForm] = useState({
    email: "",
    role: "user" as "admin" | "user"
  });
  const [resetPasswordData, setResetPasswordData] = useState<{
    username: string;
    password: string;
  } | null>(null);
  const [loginHistory, setLoginHistory] = useState<LoginRecord[]>([]);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  function formatDateTime(value: string | null) {
    if (!value) {
      return "--";
    }

    return new Date(value).toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function generateUsername() {
    const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
    const suffix = Math.floor(Math.random() * 900 + 100);
    setCreateForm((current) => ({
      ...current,
      username: `${adjective}${animal}${suffix}`
    }));
  }

  const loadUsers = useCallback(async (input?: AdminUsersQuery) => {
    setLoading(true);
    setError("");
    const result = await requestAdminUsers({
      page: input?.page || 1,
      limit: input?.limit || pagination.limit,
      searchQuery: input?.searchQuery ?? deferredSearchQuery,
      roleFilter: input?.roleFilter ?? roleFilter,
      sortField: input?.sortField ?? sortField,
      sortDirection: input?.sortDirection ?? sortDirection
    });
    if (!result.success) {
      setError(result.userMessage);
      setLoading(false);
      return;
    }

    setUsers(result.data.users || []);
    setPagination((current) => result.data.pagination || current);
    setLoading(false);
  }, [deferredSearchQuery, pagination.limit, roleFilter, sortDirection, sortField]);

  useEffect(() => {
    void loadUsers({ page: 1 });
  }, [loadUsers]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortField(field);
    setSortDirection(field === "username" || field === "email" || field === "role" ? "asc" : "desc");
  }

  function renderSortIcon(field: SortField) {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />;
    }

    return sortDirection === "asc" ? (
      <ArrowUp className="h-3.5 w-3.5 text-slate-700" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 text-slate-700" />
    );
  }

  async function handleCreateUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) {
      return;
    }

    setSubmitting(true);
    setError("");
    const result = await fetchJson<{
      user: AdminUser;
      defaultPassword?: string;
    }>("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createForm)
    });
    setSubmitting(false);

    if (!result.success) {
      setError(result.userMessage);
      return;
    }

    setMessage("用户已创建");
    setCreateOpen(false);
    setResetPasswordData({
      username: result.data.user.username,
      password: result.data.defaultPassword || createForm.password
    });
    setResetPasswordOpen(true);
    setCopied(false);
    setCreateForm(initialCreateForm);
    await loadUsers({ page: 1 });
  }

  function openEditModal(user: AdminUser) {
    setSelectedUser(user);
    setEditForm({
      email: user.email,
      role: user.role
    });
    setEditOpen(true);
  }

  async function handleEditUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedUser || submitting) {
      return;
    }

    setSubmitting(true);
    const result = await fetchJson<{ user: AdminUser }>(`/api/admin/users/${selectedUser.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm)
    });
    setSubmitting(false);

    if (!result.success) {
      setError(result.userMessage);
      return;
    }

    setMessage("用户信息已更新");
    setEditOpen(false);
    setSelectedUser(null);
    await loadUsers({ page: pagination.page });
  }

  async function handleDeleteUser(user: AdminUser) {
    if (user.isActive) {
      setError("删除前请先停用该账号");
      return;
    }

    if (!window.confirm(`确定要删除用户“${user.username}”吗？此操作不可恢复。`)) {
      return;
    }

    setActionLoading(`delete-${user.id}`);
    const result = await fetchJson<{ success: boolean }>(`/api/admin/users/${user.id}`, {
      method: "DELETE"
    });
    setActionLoading(null);
    if (!result.success) {
      setError(result.userMessage);
      return;
    }

    setMessage("用户已删除");
    const nextPage =
      users.length === 1 && pagination.page > 1 ? pagination.page - 1 : pagination.page;
    await loadUsers({
      page: Math.min(nextPage, Math.max(1, pagination.totalPages))
    });
  }

  async function handleResetPassword(user: AdminUser) {
    if (!window.confirm(`确定要重置用户“${user.username}”的密码吗？`)) {
      return;
    }

    setActionLoading(`password-${user.id}`);
    const result = await fetchJson<{ username: string; newPassword: string }>(
      `/api/admin/users/${user.id}/reset-password`,
      { method: "POST" }
    );
    setActionLoading(null);
    if (!result.success) {
      setError(result.userMessage);
      return;
    }

    setResetPasswordData({
      username: result.data.username,
      password: result.data.newPassword
    });
    setResetPasswordOpen(true);
    setCopied(false);
    setMessage("密码已重置，失败记录和现有会话已清空");
  }

  async function handleToggleUserState(user: AdminUser) {
    const nextIsActive = !user.isActive;
    const confirmed = window.confirm(
      nextIsActive
        ? `确定要恢复用户“${user.username}”的登录能力吗？`
        : `确定要停用用户“${user.username}”吗？停用后会立即清空该账号的现有会话。`
    );

    if (!confirmed) {
      return;
    }

    setActionLoading(`toggle-${user.id}`);
    setError("");
    const result = await fetchJson<{ user: AdminUser }>(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: nextIsActive })
    });
    setActionLoading(null);

    if (!result.success) {
      setError(result.userMessage);
      return;
    }

    setMessage(nextIsActive ? "账号已启用" : "账号已停用并清空现有会话");
    await loadUsers({ page: pagination.page });
  }

  async function handleUnlockUser(user: AdminUser) {
    const confirmed = window.confirm(
      isUserLocked(user)
        ? `确定要清空用户“${user.username}”的失败登录记录并解除锁定吗？`
        : `确定要清空用户“${user.username}”的失败登录记录吗？`
    );

    if (!confirmed) {
      return;
    }

    setActionLoading(`unlock-${user.id}`);
    setError("");
    const result = await fetchJson<{ user: AdminUser }>(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unlock: true })
    });
    setActionLoading(null);

    if (!result.success) {
      setError(result.userMessage);
      return;
    }

    setMessage("锁定状态和失败记录已清空");
    await loadUsers({ page: pagination.page });
  }

  async function handleLoadLoginHistory(user: AdminUser) {
    setSelectedUser(user);
    setHistoryOpen(true);
    setHistoryLoading(true);
    setLoginHistory([]);

    const result = await fetchJson<{ records: LoginRecord[] }>(
      `/api/admin/users/${user.id}/login-history?limit=50`
    );
    setHistoryLoading(false);

    if (!result.success) {
      setError(result.userMessage);
      return;
    }

    setLoginHistory(result.data.records || []);
  }

  async function copyPassword() {
    if (!resetPasswordData) {
      return;
    }

    await navigator.clipboard.writeText(
      `用户名: ${resetPasswordData.username}\n密码: ${resetPasswordData.password}`
    );
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  const emptyState = !loading && users.length === 0;
  const overview = useMemo(() => {
    const pageEnabledCount = users.filter((user) => user.isActive).length;
    const pageLockedCount = users.filter((user) => isUserLocked(user)).length;
    const pageDisabledCount = users.filter((user) => !user.isActive).length;
    const pageRiskCount = users.filter((user) => !user.isActive || isUserLocked(user) || user.failedLoginCount > 0).length;

    return {
      totalUsers: pagination.total,
      pageEnabledCount,
      pageLockedCount,
      pageDisabledCount,
      pageRiskCount
    };
  }, [pagination.total, users]);

  return (
    <div className="space-y-6">
      <section className="surface-panel overflow-hidden p-0">
        <div className="grid gap-0 xl:grid-cols-[1.05fr,0.95fr]">
          <div className="bg-[radial-gradient(circle_at_top_left,rgba(5,150,105,0.16),transparent_48%),linear-gradient(180deg,rgba(236,253,245,0.95)_0%,rgba(255,255,255,0.98)_100%)] px-6 py-7 sm:px-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="eyebrow">Admin</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">用户管理</h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">
                  管理后台账号、角色边界、登录会话和密码重置，优先保证运营账号可用、管理员权限收敛。
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-brand-line bg-white/90 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-emerald-200 hover:text-brand-emerald disabled:opacity-60"
                  disabled={loading}
                  onClick={() => void loadUsers({ page: pagination.page })}
                  type="button"
                >
                  <RefreshCcw className={cnIcon(loading)} />
                  刷新列表
                </button>
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-emerald px-5 py-3 text-sm font-semibold text-white"
                  onClick={() => setCreateOpen(true)}
                  type="button"
                >
                  <Plus className="h-4 w-4" />
                  新建用户
                </button>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <QuickActionCard
                description="离岗、交接或异常登录时，先停用账号，立即回收当前登录能力。"
                icon={ShieldAlert}
                title="先收口风险账号"
              />
              <QuickActionCard
                description="爆破或误输密码触发锁定后，可直接清空失败记录并恢复登录。"
                icon={RefreshCcw}
                title="快速解除锁定"
              />
            </div>
          </div>

          <div className="bg-white px-6 py-7 sm:px-8">
            <p className="eyebrow">Overview</p>
            <h3 className="mt-3 text-2xl font-semibold text-slate-900">当前页用户态势</h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              先看启用率、锁定数和风险账号，再决定是做权限调整、密码重置还是停用处理。
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <AdminOverviewCard
                label="总用户数"
                note="当前筛选条件下的全部用户总量。"
                tone="slate"
                value={String(overview.totalUsers)}
              />
              <AdminOverviewCard
                label="本页启用账号"
                note="仍保留登录能力的账号数量，用来判断当前可用席位。"
                tone={overview.pageEnabledCount > 0 ? "emerald" : "slate"}
                value={String(overview.pageEnabledCount)}
              />
              <AdminOverviewCard
                label="本页锁定账号"
                note="因连续失败登录被临时锁定的账号数量。"
                tone={overview.pageLockedCount > 0 ? "amber" : "slate"}
                value={String(overview.pageLockedCount)}
              />
              <AdminOverviewCard
                label="本页风险账号"
                note="包含停用、锁定或存在失败登录记录的账号。"
                tone={overview.pageRiskCount > 0 ? "amber" : "slate"}
                value={String(overview.pageRiskCount)}
              />
            </div>

            {overview.pageDisabledCount > 0 ? (
              <div className="mt-4 rounded-[24px] border border-brand-line bg-stone-50 px-4 py-4 text-sm text-slate-600">
                当前页有 {overview.pageDisabledCount} 个已停用账号。删除用户前需要先保持停用状态，避免误删仍在使用中的账号。
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="surface-panel p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
            <label className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="w-full rounded-2xl border border-brand-line bg-stone-50 py-3 pl-11 pr-4 text-sm text-slate-800"
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="搜索用户名或邮箱"
                value={searchQuery}
              />
            </label>

            <select
              className="rounded-2xl border border-brand-line bg-stone-50 px-4 py-3 text-sm text-slate-800"
              onChange={(event) => setRoleFilter(event.target.value as "all" | "admin" | "user")}
              value={roleFilter}
            >
              <option value="all">全部角色</option>
              <option value="admin">管理员</option>
              <option value="user">普通用户</option>
            </select>

            <select
              className="rounded-2xl border border-brand-line bg-stone-50 px-4 py-3 text-sm text-slate-800"
              onChange={(event) => void loadUsers({ page: 1, limit: Number(event.target.value || 10) })}
              value={pagination.limit}
            >
              <option value="10">10 / 页</option>
              <option value="20">20 / 页</option>
              <option value="50">50 / 页</option>
            </select>
          </div>

          <p className="text-sm text-slate-500">
            共 {pagination.total} 个用户，当前第 {pagination.page} / {pagination.totalPages} 页
          </p>
        </div>

        {message ? <p className="mt-4 text-sm text-emerald-700">{message}</p> : null}
        {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}

        <div className="mt-6 overflow-x-auto rounded-[28px] border border-brand-line">
          <table className="min-w-[1160px] w-full text-left text-sm">
            <thead className="bg-stone-50 text-slate-500">
              <tr className="border-b border-brand-line/70">
                <SortableHeader field="username" label="用户" onSort={handleSort} renderIcon={renderSortIcon} />
                <SortableHeader field="role" label="角色" onSort={handleSort} renderIcon={renderSortIcon} />
                <th className="pb-3 pr-4">状态与风险</th>
                <th className="pb-3 pr-4">会话</th>
                <SortableHeader field="lastLoginAt" label="上次活动" onSort={handleSort} renderIcon={renderSortIcon} />
                <SortableHeader field="createdAt" label="创建时间" onSort={handleSort} renderIcon={renderSortIcon} />
                <th className="pb-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {loading ? (
                <tr>
                  <td className="px-4 py-8 text-slate-500" colSpan={7}>
                    正在加载用户列表...
                  </td>
                </tr>
              ) : null}

              {emptyState ? (
                <tr>
                  <td className="px-4 py-8 text-slate-500" colSpan={7}>
                    当前筛选条件下没有用户。
                  </td>
                </tr>
              ) : null}

              {!loading
                ? users.map((user) => (
                    <tr className="border-b border-brand-line/40 align-top last:border-b-0" key={user.id}>
                      <td className="px-4 py-4 pr-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-mist text-sm font-semibold text-brand-emerald">
                            {user.username.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-900">{user.username}</p>
                            <p className="truncate text-xs text-slate-500">{user.email || "未设置邮箱"}</p>
                            <p className="mt-1 text-xs text-slate-400">ID {user.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 pr-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            user.role === "admin"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {user.role === "admin" ? "管理员" : "普通用户"}
                        </span>
                      </td>
                      <td className="px-4 py-4 pr-4">
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-2">
                            <span className={getStatusBadgeClass(user)}>
                              {getStatusBadgeLabel(user)}
                            </span>
                            {user.failedLoginCount > 0 ? (
                              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                                失败 {user.failedLoginCount} 次
                              </span>
                            ) : null}
                          </div>
                          <p className="text-xs leading-5 text-slate-500">{getUserRiskSummary(user)}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4 pr-4">
                        <div className="space-y-1 text-sm text-slate-700">
                          <p>
                            {user.activeSessionCount > 0
                              ? `${user.activeSessionCount} 个活跃会话`
                              : "暂无活跃会话"}
                          </p>
                          <p className="text-xs text-slate-500">
                            {!user.isActive
                              ? "账号已停用，现有会话会被系统回收。"
                              : user.activeSessionCount > 0
                                ? "账号当前仍处于登录态。"
                                : "可用于判断是否已完成交接。"}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-4 pr-4 text-slate-700">{formatDateTime(user.lastLoginAt)}</td>
                      <td className="px-4 py-4 pr-4 text-slate-700">{formatDateTime(user.createdAt)}</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap justify-end gap-2">
                          <ActionButton
                            disabled={actionLoading !== null}
                            icon={PencilLine}
                            label="编辑"
                            onClick={() => openEditModal(user)}
                          />
                          <ActionButton
                            disabled={actionLoading !== null}
                            icon={KeyRound}
                            label="重置密码"
                            onClick={() => void handleResetPassword(user)}
                          />
                          <ActionButton
                            disabled={actionLoading !== null}
                            icon={History}
                            label="登录记录"
                            onClick={() => void handleLoadLoginHistory(user)}
                          />
                          {isUserLocked(user) || user.failedLoginCount > 0 ? (
                            <ActionButton
                              disabled={actionLoading !== null}
                              icon={RefreshCcw}
                              label={isUserLocked(user) ? "解除锁定" : "清空失败"}
                              onClick={() => void handleUnlockUser(user)}
                              tone="amber"
                            />
                          ) : null}
                          <ActionButton
                            disabled={actionLoading !== null}
                            icon={user.isActive ? ShieldAlert : Check}
                            label={user.isActive ? "停用" : "启用"}
                            onClick={() => void handleToggleUserState(user)}
                            tone={user.isActive ? "amber" : "emerald"}
                          />
                          <ActionButton
                            disabled={actionLoading !== null || user.isActive}
                            icon={Trash2}
                            label="删除"
                            onClick={() => void handleDeleteUser(user)}
                            tone="danger"
                          />
                        </div>
                      </td>
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex flex-col gap-3 border-t border-brand-line/60 pt-4 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p>搜索和角色筛选会实时生效，列表默认按创建时间倒序排列。</p>
            <p>停用会立即回收现有会话；解除锁定会同步清空失败登录计数；删除前需要先停用账号。</p>
          </div>
          <div className="flex gap-2">
            <button
              className="rounded-2xl border border-brand-line bg-white px-4 py-2 font-medium disabled:opacity-40"
              disabled={pagination.page <= 1 || loading}
              onClick={() => void loadUsers({ page: pagination.page - 1 })}
              type="button"
            >
              上一页
            </button>
            <button
              className="rounded-2xl border border-brand-line bg-white px-4 py-2 font-medium disabled:opacity-40"
              disabled={pagination.page >= pagination.totalPages || loading}
              onClick={() => void loadUsers({ page: pagination.page + 1 })}
              type="button"
            >
              下一页
            </button>
          </div>
        </div>
      </section>

      <ModalFrame
        description="创建新的后台用户，并在完成后复制登录信息。"
        eyebrow="用户管理"
        onClose={() => setCreateOpen(false)}
        open={createOpen}
        title="新建用户"
      >
        <form className="space-y-5" onSubmit={handleCreateUser}>
          <div className="grid gap-4 md:grid-cols-[1fr,auto]">
            <label className="block text-sm text-slate-700">
              用户名
              <input
                className="mt-2 w-full rounded-2xl border border-brand-line bg-stone-50 px-4 py-3"
                onChange={(event) => setCreateForm((current) => ({ ...current, username: event.target.value }))}
                placeholder="请输入用户名"
                value={createForm.username}
              />
            </label>
            <button
              className="mt-7 rounded-2xl border border-brand-line bg-white px-4 py-3 text-sm font-semibold text-slate-700"
              onClick={generateUsername}
              type="button"
            >
              自动生成
            </button>
          </div>

          <label className="block text-sm text-slate-700">
            邮箱
            <input
              className="mt-2 w-full rounded-2xl border border-brand-line bg-stone-50 px-4 py-3"
              onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="请输入邮箱"
              value={createForm.email}
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm text-slate-700">
              角色
              <select
                className="mt-2 w-full rounded-2xl border border-brand-line bg-stone-50 px-4 py-3"
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    role: event.target.value as "admin" | "user"
                  }))
                }
                value={createForm.role}
              >
                <option value="user">普通用户</option>
                <option value="admin">管理员</option>
              </select>
            </label>

            <label className="block text-sm text-slate-700">
              初始密码
              <input
                className="mt-2 w-full rounded-2xl border border-brand-line bg-stone-50 px-4 py-3"
                onChange={(event) => setCreateForm((current) => ({ ...current, password: event.target.value }))}
                placeholder="留空则自动生成"
                type="password"
                value={createForm.password}
              />
            </label>
          </div>

          <div className="flex justify-end gap-3">
            <button
              className="rounded-2xl border border-brand-line bg-white px-5 py-3 text-sm font-semibold text-slate-700"
              onClick={() => setCreateOpen(false)}
              type="button"
            >
              取消
            </button>
            <button
              className="rounded-2xl bg-brand-emerald px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
              disabled={submitting}
              type="submit"
            >
              {submitting ? "创建中..." : "创建用户"}
            </button>
          </div>
        </form>
      </ModalFrame>

      <ModalFrame
        description="更新用户邮箱和角色。"
        eyebrow="用户管理"
        onClose={() => setEditOpen(false)}
        open={editOpen}
        title={selectedUser ? `编辑 ${selectedUser.username}` : "编辑用户"}
      >
        <form className="space-y-5" onSubmit={handleEditUser}>
          <label className="block text-sm text-slate-700">
            邮箱
            <input
              className="mt-2 w-full rounded-2xl border border-brand-line bg-stone-50 px-4 py-3"
              onChange={(event) => setEditForm((current) => ({ ...current, email: event.target.value }))}
              value={editForm.email}
            />
          </label>

          <label className="block text-sm text-slate-700">
            角色
            <select
              className="mt-2 w-full rounded-2xl border border-brand-line bg-stone-50 px-4 py-3"
              onChange={(event) =>
                setEditForm((current) => ({
                  ...current,
                  role: event.target.value as "admin" | "user"
                }))
              }
              value={editForm.role}
            >
              <option value="user">普通用户</option>
              <option value="admin">管理员</option>
            </select>
          </label>

          <div className="flex justify-end gap-3">
            <button
              className="rounded-2xl border border-brand-line bg-white px-5 py-3 text-sm font-semibold text-slate-700"
              onClick={() => setEditOpen(false)}
              type="button"
            >
              取消
            </button>
            <button
              className="rounded-2xl bg-brand-emerald px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
              disabled={submitting}
              type="submit"
            >
              {submitting ? "保存中..." : "保存修改"}
            </button>
          </div>
        </form>
      </ModalFrame>

      <ModalFrame
        description="请立即复制并安全发送给对应用户。"
        eyebrow="用户管理"
        onClose={() => setResetPasswordOpen(false)}
        open={resetPasswordOpen}
        title="密码信息"
      >
        {resetPasswordData ? (
          <div className="space-y-4">
            <div className="rounded-[28px] border border-brand-line bg-stone-50 p-5">
              <p className="text-sm text-slate-500">用户名</p>
              <p className="mt-1 font-medium text-slate-900">{resetPasswordData.username}</p>
              <p className="mt-4 text-sm text-slate-500">密码</p>
              <p className="mt-1 font-mono text-base text-slate-900">{resetPasswordData.password}</p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                className="inline-flex items-center gap-2 rounded-2xl border border-brand-line bg-white px-5 py-3 text-sm font-semibold text-slate-700"
                onClick={() => void copyPassword()}
                type="button"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "已复制" : "复制信息"}
              </button>
            </div>
          </div>
        ) : null}
      </ModalFrame>

      <ModalFrame
        description={selectedUser ? `查看 ${selectedUser.username} 最近的登录会话记录。` : undefined}
        eyebrow="用户管理"
        onClose={() => setHistoryOpen(false)}
        open={historyOpen}
        title="登录记录"
      >
        {historyLoading ? (
          <p className="text-sm text-slate-500">正在加载登录记录...</p>
        ) : (
          <div className="space-y-3">
            {loginHistory.length ? (
              loginHistory.map((record) => (
                <div className="rounded-[24px] border border-brand-line bg-stone-50 p-4" key={record.sessionId}>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          record.status === "active"
                            ? "bg-emerald-50 text-emerald-700"
                            : record.status === "expired"
                              ? "bg-stone-200 text-slate-700"
                              : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {record.status === "active"
                          ? "活跃"
                          : record.status === "expired"
                            ? "已过期"
                            : "已撤销"}
                      </span>
                      <span className="text-xs text-slate-500">{record.sessionId.slice(0, 12)}...</span>
                    </div>
                    <span className="text-xs text-slate-500">最后活动：{formatDateTime(record.lastActivityAt)}</span>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                    <p>登录时间：{formatDateTime(record.createdAt)}</p>
                    <p>过期时间：{formatDateTime(record.expiresAt)}</p>
                    <p>IP：{record.ipAddress || "--"}</p>
                    <p className="sm:col-span-2">设备：{record.userAgent || "--"}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">暂无登录记录。</p>
            )}
          </div>
        )}
      </ModalFrame>
    </div>
  );
}

function SortableHeader(props: {
  field: SortField;
  label: string;
  onSort: (field: SortField) => void;
  renderIcon: (field: SortField) => React.ReactNode;
}) {
  return (
    <th className="pb-3 pr-4">
      <button
        className="inline-flex items-center gap-1 font-medium"
        onClick={() => props.onSort(props.field)}
        type="button"
      >
        {props.label}
        {props.renderIcon(props.field)}
      </button>
    </th>
  );
}

function cnIcon(loading: boolean) {
  return loading ? "h-4 w-4 animate-spin" : "h-4 w-4";
}

function isUserLocked(user: Pick<AdminUser, "lockedUntil">) {
  if (!user.lockedUntil) {
    return false;
  }

  const timestamp = Date.parse(user.lockedUntil);
  return Number.isFinite(timestamp) && timestamp > Date.now();
}

function getUserLockMinutes(lockedUntil: string | null) {
  if (!lockedUntil) {
    return 0;
  }

  const timestamp = Date.parse(lockedUntil);
  if (!Number.isFinite(timestamp)) {
    return 0;
  }

  return Math.max(0, Math.ceil((timestamp - Date.now()) / (60 * 1000)));
}

function getStatusBadgeClass(user: AdminUser) {
  if (!user.isActive) {
    return "rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700";
  }

  if (isUserLocked(user)) {
    return "rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700";
  }

  return "rounded-full bg-brand-mist px-3 py-1 text-xs font-semibold text-brand-emerald";
}

function getStatusBadgeLabel(user: AdminUser) {
  if (!user.isActive) {
    return "已停用";
  }

  if (isUserLocked(user)) {
    const remainingMinutes = getUserLockMinutes(user.lockedUntil);
    return remainingMinutes > 0 ? `已锁定 · ${remainingMinutes} 分钟` : "已锁定";
  }

  return "正常";
}

function getUserRiskSummary(user: AdminUser) {
  if (!user.isActive) {
    return "已收回登录能力，适合交接或异常账号临时下线。";
  }

  if (isUserLocked(user)) {
    return "连续失败登录次数过多，解除锁定后才能继续密码登录。";
  }

  if (user.failedLoginCount > 0) {
    return `近期存在 ${user.failedLoginCount} 次失败登录，可按需清空记录或重置密码。`;
  }

  return "当前未发现登录侧风险，可继续保留账号运行。";
}

function QuickActionCard(props: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  const Icon = props.icon;

  return (
    <div className="rounded-[24px] border border-brand-line bg-white/90 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-mist text-brand-emerald">
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-4 text-sm font-semibold text-slate-900">{props.title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{props.description}</p>
    </div>
  );
}

function AdminOverviewCard(props: {
  label: string;
  value: string;
  note: string;
  tone: "emerald" | "amber" | "slate";
}) {
  const toneClass =
    props.tone === "emerald"
      ? "bg-brand-mist text-brand-emerald"
      : props.tone === "amber"
        ? "bg-amber-50 text-amber-700"
        : "bg-slate-100 text-slate-700";
  const valueClass =
    props.tone === "emerald"
      ? "text-brand-emerald"
      : props.tone === "amber"
        ? "text-amber-700"
        : "text-slate-900";

  return (
    <div className="rounded-[24px] border border-brand-line bg-stone-50 px-4 py-4">
      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${toneClass}`}>
        {props.label}
      </span>
      <p className={`mt-4 font-mono text-3xl font-semibold ${valueClass}`}>{props.value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{props.note}</p>
    </div>
  );
}

function ActionButton(props: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "emerald" | "amber" | "danger";
}) {
  const Icon = props.icon;
  const toneClass =
    props.tone === "danger"
      ? "border-red-200 bg-red-50 text-red-700 disabled:border-red-100 disabled:bg-red-50/60"
      : props.tone === "emerald"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700 disabled:border-emerald-100 disabled:bg-emerald-50/60"
        : props.tone === "amber"
          ? "border-amber-200 bg-amber-50 text-amber-700 disabled:border-amber-100 disabled:bg-amber-50/60"
          : "border-brand-line bg-white text-slate-700";

  return (
    <button
      className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${toneClass}`}
      disabled={props.disabled}
      onClick={props.onClick}
      type="button"
    >
      <Icon className="h-3.5 w-3.5" />
      {props.label}
    </button>
  );
}
