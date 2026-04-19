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
  MoreHorizontal,
  PencilLine,
  Plus,
  RefreshCcw,
  Search,
  ShieldAlert,
  Trash2
} from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  EmptyState,
  PageHeader,
  StatusBadge,
  TableSkeleton,
  type StatusBadgeVariant,
  cn
} from "@autocashback/ui";
import { toast } from "sonner";

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
  id: string;
  source: "session" | "audit";
  eventType: "login_success" | "login_failed" | "account_locked";
  sessionId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  lastActivityAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  status: "active" | "expired" | "revoked" | "failed" | "locked";
  failureReason: string | null;
};

type SecurityAlert = {
  id: string;
  severity: "critical" | "warning" | "info";
  category:
    | "lockout"
    | "failed-login"
    | "active-session-spread"
    | "recent-ip-spread"
    | "recent-device-spread";
  title: string;
  description: string;
  createdAt: string;
  evidence: Array<{
    label: string;
    value: string;
  }>;
};

type SortField = "id" | "username" | "email" | "role" | "createdAt" | "lastLoginAt" | "status";
type SortDirection = "asc" | "desc";
type StatusFilter = "all" | "risk" | "locked" | "disabled" | "active-session";
type AdminUsersQuery = {
  page?: number;
  limit?: number;
  searchQuery?: string;
  roleFilter?: "all" | "admin" | "user";
  statusFilter?: StatusFilter;
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

const STATUS_FILTER_OPTIONS: Array<{
  value: StatusFilter;
  label: string;
  description: string;
}> = [
  {
    value: "all",
    label: "全部账号",
    description: "查看当前筛选条件下的完整用户池。"
  },
  {
    value: "risk",
    label: "风险账号",
    description: "聚焦停用、锁定或出现失败登录记录的账号。"
  },
  {
    value: "locked",
    label: "已锁定",
    description: "优先处理连续失败登录后被系统锁定的账号。"
  },
  {
    value: "disabled",
    label: "已停用",
    description: "查看已收回登录能力、待恢复或待删除的账号。"
  },
  {
    value: "active-session",
    label: "活跃会话",
    description: "聚焦当前仍在登录态、需要交接或回收会话的账号。"
  }
];

async function requestAdminUsers(input: AdminUsersQuery) {
  const params = new URLSearchParams({
    page: String(input.page || 1),
    limit: String(input.limit || 10),
    search: input.searchQuery ?? "",
    role: input.roleFilter ?? "all",
    status: input.statusFilter ?? "all",
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
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "user">("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [createForm, setCreateForm] = useState(initialCreateForm);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [alertsUser, setAlertsUser] = useState<AdminUser | null>(null);
  const [editForm, setEditForm] = useState({
    email: "",
    role: "user" as "admin" | "user"
  });
  const [resetPasswordData, setResetPasswordData] = useState<{
    username: string;
    password: string;
  } | null>(null);
  const [loginHistory, setLoginHistory] = useState<LoginRecord[]>([]);
  const [historyIpQuery, setHistoryIpQuery] = useState("");
  const [securityAlerts, setSecurityAlerts] = useState<SecurityAlert[]>([]);
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
    const result = await requestAdminUsers({
      page: input?.page || 1,
      limit: input?.limit || pagination.limit,
      searchQuery: input?.searchQuery ?? deferredSearchQuery,
      roleFilter: input?.roleFilter ?? roleFilter,
      statusFilter: input?.statusFilter ?? statusFilter,
      sortField: input?.sortField ?? sortField,
      sortDirection: input?.sortDirection ?? sortDirection
    });
    if (!result.success) {
      toast.error(result.userMessage || "操作失败");
      setLoading(false);
      return;
    }

    setUsers(result.data.users || []);
    setPagination((current) => result.data.pagination || current);
    setLoading(false);
  }, [deferredSearchQuery, pagination.limit, roleFilter, sortDirection, sortField, statusFilter]);

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
      return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/80" />;
    }

    return sortDirection === "asc" ? (
      <ArrowUp className="h-3.5 w-3.5 text-foreground" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 text-foreground" />
    );
  }

  async function handleCreateUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) {
      return;
    }

    setSubmitting(true);
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
      toast.error(result.userMessage || "操作失败");
      return;
    }

    toast.success(("用户已创建"));
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
      toast.error(result.userMessage || "操作失败");
      return;
    }

    toast.success(("用户信息已更新"));
    setEditOpen(false);
    setSelectedUser(null);
    await loadUsers({ page: pagination.page });
  }

  async function handleDeleteUser(user: AdminUser) {
    if (user.isActive) {
      toast.error("删除前请先停用该账号");
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
      toast.error(result.userMessage || "操作失败");
      return;
    }

    toast.success(("用户已删除"));
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
      toast.error(result.userMessage || "操作失败");
      return;
    }

    setResetPasswordData({
      username: result.data.username,
      password: result.data.newPassword
    });
    setResetPasswordOpen(true);
    setCopied(false);
    toast.success(("密码已重置，失败记录和现有会话已清空"));
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
    const result = await fetchJson<{ user: AdminUser }>(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: nextIsActive })
    });
    setActionLoading(null);

    if (!result.success) {
      toast.error(result.userMessage || "操作失败");
      return;
    }

    toast.success(nextIsActive ? "账号已启用" : "账号已停用并清空现有会话");
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
    const result = await fetchJson<{ user: AdminUser }>(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unlock: true })
    });
    setActionLoading(null);

    if (!result.success) {
      toast.error(result.userMessage || "操作失败");
      return;
    }

    toast.success(("锁定状态和失败记录已清空"));
    await loadUsers({ page: pagination.page });
  }

  async function handleLoadLoginHistory(user: AdminUser) {
    setSelectedUser(user);
    setHistoryOpen(true);
    setHistoryLoading(true);
    setHistoryIpQuery("");
    setLoginHistory([]);

    const result = await fetchJson<{ records: LoginRecord[] }>(
      `/api/admin/users/${user.id}/login-history?limit=50`
    );
    setHistoryLoading(false);

    if (!result.success) {
      toast.error(result.userMessage || "操作失败");
      return;
    }

    setLoginHistory(result.data.records || []);
  }

  async function handleLoadSecurityAlerts(user: AdminUser) {
    setAlertsUser(user);
    setAlertsOpen(true);
    setAlertsLoading(true);
    setSecurityAlerts([]);

    const result = await fetchJson<{ alerts: SecurityAlert[] }>(
      `/api/admin/users/${user.id}/alerts`
    );
    setAlertsLoading(false);

    if (!result.success) {
      toast.error(result.userMessage || "操作失败");
      return;
    }

    setSecurityAlerts(result.data.alerts || []);
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
  const filteredLoginHistory = useMemo(() => {
    const normalizedQuery = historyIpQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return loginHistory;
    }

    return loginHistory.filter((record) => (record.ipAddress || "").toLowerCase().includes(normalizedQuery));
  }, [historyIpQuery, loginHistory]);

  const groupedSecurityAlerts = useMemo(() => {
    const recent: SecurityAlert[] = [];
    const older: SecurityAlert[] = [];
    const threshold = Date.now() - 7 * 24 * 60 * 60 * 1000;

    for (const alert of securityAlerts) {
      const createdAt = Date.parse(alert.createdAt);
      if (Number.isFinite(createdAt) && createdAt >= threshold) {
        recent.push(alert);
      } else {
        older.push(alert);
      }
    }

    return { recent, older };
  }, [securityAlerts]);

  const overview = useMemo(() => {
    const pageSessionUsersCount = users.filter((user) => user.activeSessionCount > 0).length;
    const pageLockedCount = users.filter((user) => isUserLocked(user)).length;
    const pageDisabledCount = users.filter((user) => !user.isActive).length;
    const pageRiskCount = users.filter((user) => !user.isActive || isUserLocked(user) || user.failedLoginCount > 0).length;

    return {
      totalUsers: pagination.total,
      pageSessionUsersCount,
      pageLockedCount,
      pageDisabledCount,
      pageRiskCount
    };
  }, [pagination.total, users]);

  return (
    <div className="space-y-6">
      <PageHeader
        description="维护后台账号、登录状态和安全风险，重点操作直接在列表中完成。"
        title="用户管理"
        actions={
          <>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground transition hover:border-emerald-200 hover:text-primary disabled:opacity-60"
              disabled={loading}
              onClick={() => void loadUsers({ page: pagination.page })}
              type="button"
            >
              <RefreshCcw className={cnIcon(loading)} />
              刷新列表
            </button>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
              onClick={() => setCreateOpen(true)}
              type="button"
            >
              <Plus className="h-4 w-4" />
              新建用户
            </button>
          </>
        }
      />

      <section className="bg-card text-card-foreground rounded-xl border shadow-sm p-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">账号列表</p>
              <p className="mt-1 text-sm text-muted-foreground">
                参考 autobb 的简洁结构，保留筛选、统计和表格操作，让视线直接落到列表。
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              共 {pagination.total} 个用户，当前第 {pagination.page} / {pagination.totalPages} 页
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <OverviewFilterCard
              description="当前筛选条件下的全部用户。"
              label="总用户数"
              onClick={() => setStatusFilter("all")}
              selected={statusFilter === "all"}
              tone="slate"
              value={String(overview.totalUsers)}
            />
            <OverviewFilterCard
              description="仍处于登录态，适合巡检交接和共享风险。"
              label="活跃会话"
              onClick={() => setStatusFilter("active-session")}
              selected={statusFilter === "active-session"}
              tone={overview.pageSessionUsersCount > 0 ? "emerald" : "slate"}
              value={String(overview.pageSessionUsersCount)}
            />
            <OverviewFilterCard
              description="连续失败登录后被系统临时锁定。"
              label="锁定账号"
              onClick={() => setStatusFilter("locked")}
              selected={statusFilter === "locked"}
              tone={overview.pageLockedCount > 0 ? "amber" : "slate"}
              value={String(overview.pageLockedCount)}
            />
            <OverviewFilterCard
              description="停用、锁定或存在失败登录记录。"
              label="风险账号"
              onClick={() => setStatusFilter("risk")}
              selected={statusFilter === "risk"}
              tone={overview.pageRiskCount > 0 ? "amber" : "slate"}
              value={String(overview.pageRiskCount)}
            />
          </div>

          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
              <label className="relative flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/80" />
                <input
                  className="w-full rounded-lg border border-border bg-muted/40 py-3 pl-11 pr-4 text-sm text-foreground"
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="搜索用户名或邮箱"
                  value={searchQuery}
                />
              </label>

              <select
                className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground"
                onChange={(event) => setRoleFilter(event.target.value as "all" | "admin" | "user")}
                value={roleFilter}
              >
                <option value="all">全部角色</option>
                <option value="admin">管理员</option>
                <option value="user">普通用户</option>
              </select>

              <select
                className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground"
                onChange={(event) => void loadUsers({ page: 1, limit: Number(event.target.value || 10) })}
                value={pagination.limit}
              >
                <option value="10">10 / 页</option>
                <option value="20">20 / 页</option>
                <option value="50">50 / 页</option>
              </select>

              {(searchQuery || roleFilter !== "all" || statusFilter !== "all") ? (
                <button
                  className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground transition hover:border-emerald-200 hover:text-primary"
                  onClick={() => {
                    setSearchQuery("");
                    setRoleFilter("all");
                    setStatusFilter("all");
                  }}
                  type="button"
                >
                  清空筛选
                </button>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              {STATUS_FILTER_OPTIONS.map((option) => (
                <button
                  className={`rounded-lg border px-3 py-2 text-left transition ${
                    statusFilter === option.value
                      ? "border-emerald-300 bg-primary/10 text-primary shadow-[0_10px_30px_rgba(5,150,105,0.08)]"
                      : "border-border bg-background text-foreground hover:border-emerald-200 hover:text-primary"
                  }`}
                  key={option.value}
                  onClick={() => setStatusFilter(option.value)}
                  type="button"
                >
                  <p className="text-sm font-semibold">{option.label}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{option.description}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {overview.pageDisabledCount > 0 ? (
          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <p>当前页有 {overview.pageDisabledCount} 个已停用账号。删除前请保持停用状态，避免误删仍在使用中的账号。</p>
            <button
              className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 py-2 font-semibold text-foreground transition hover:border-emerald-200 hover:text-primary"
              onClick={() => setStatusFilter("disabled")}
              type="button"
            >
              查看停用账号
            </button>
          </div>
        ) : null}

        {loading ? (
          <TableSkeleton className="mt-6" rows={Math.min(8, pagination.limit)} />
        ) : emptyState ? (
          <EmptyState
            className="mt-6"
            description="可以调整搜索、角色或状态筛选，或直接创建新用户。"
            icon={Search}
            title="当前筛选条件下没有用户"
          />
        ) : (
          <div className="mt-6 overflow-x-auto rounded-xl border border-border">
            <table className="min-w-[1160px] w-full text-left text-sm">
              <thead className="bg-muted/40 text-muted-foreground sticky top-0 z-10 bg-background/95 backdrop-blur">
                <tr className="border-b border-border/70">
                  <SortableHeader field="username" label="用户" onSort={handleSort} renderIcon={renderSortIcon} />
                  <SortableHeader field="role" label="角色" onSort={handleSort} renderIcon={renderSortIcon} />
                  <SortableHeader field="status" label="状态与风险" onSort={handleSort} renderIcon={renderSortIcon} />
                  <th className="pb-3 pr-4">会话</th>
                  <SortableHeader field="lastLoginAt" label="上次活动" onSort={handleSort} renderIcon={renderSortIcon} />
                  <SortableHeader field="createdAt" label="创建时间" onSort={handleSort} renderIcon={renderSortIcon} />
                  <th className="pb-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="bg-background">
                {users.map((user) => {
                  const userStatusBadge = getUserStatusBadge(user);

                  return (
                  <tr className={getUserRowClassName(user)} key={user.id}>
                    <td className="p-4 pr-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
                          {user.username.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{user.username}</p>
                          <p className="truncate text-xs text-muted-foreground">{user.email || "未设置邮箱"}</p>
                          <p className="mt-1 text-xs text-muted-foreground/80">ID {user.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 pr-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          user.role === "admin"
                            ? "bg-amber-500/10 text-amber-600"
                            : "bg-slate-100 text-foreground"
                        }`}
                      >
                        {user.role === "admin" ? "管理员" : "普通用户"}
                      </span>
                    </td>
                    <td className="p-4 pr-4">
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                          <StatusBadge
                            label={userStatusBadge.label}
                            variant={userStatusBadge.variant}
                          />
                          {user.failedLoginCount > 0 ? (
                            <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-600">
                              失败 {user.failedLoginCount} 次
                            </span>
                          ) : null}
                        </div>
                        <p className="text-xs leading-5 text-muted-foreground">{getUserRiskSummary(user)}</p>
                      </div>
                    </td>
                    <td className="p-4 pr-4">
                      <div className="space-y-1 text-sm text-foreground">
                        <p>
                          {user.activeSessionCount > 0
                            ? `${user.activeSessionCount} 个活跃会话`
                            : "暂无活跃会话"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {!user.isActive
                            ? "账号已停用，现有会话会被系统回收。"
                            : user.activeSessionCount > 0
                              ? "账号当前仍处于登录态。"
                              : "可用于判断是否已完成交接。"}
                        </p>
                      </div>
                    </td>
                    <td className="p-4 pr-4 text-foreground">{formatDateTime(user.lastLoginAt)}</td>
                    <td className="p-4 pr-4 text-foreground">{formatDateTime(user.createdAt)}</td>
                    <td className="p-4">
                      <div className="flex flex-wrap justify-end gap-2">
                        <ActionButton
                          disabled={actionLoading !== null}
                          icon={PencilLine}
                          label="编辑"
                          onClick={() => openEditModal(user)}
                        />
                        <ActionButton
                          disabled={actionLoading !== null}
                          icon={History}
                          label="登录记录"
                          onClick={() => void handleLoadLoginHistory(user)}
                        />
                        <DropdownMenu.Root>
                          <DropdownMenu.Trigger asChild>
                            <button
                              className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={actionLoading !== null}
                              type="button"
                            >
                              <MoreHorizontal className="h-3.5 w-3.5" />
                              更多
                            </button>
                          </DropdownMenu.Trigger>
                          <DropdownMenu.Portal>
                            <DropdownMenu.Content
                              align="end"
                              className="z-50 min-w-[190px] rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg"
                              sideOffset={6}
                            >
                              <DropdownMenu.Item
                                className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm outline-none hover:bg-muted focus:bg-muted"
                                onSelect={() => void handleLoadSecurityAlerts(user)}
                              >
                                <ShieldAlert className="h-4 w-4" />
                                安全告警
                              </DropdownMenu.Item>
                              <DropdownMenu.Item
                                className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm outline-none hover:bg-muted focus:bg-muted"
                                onSelect={() => void handleResetPassword(user)}
                              >
                                <KeyRound className="h-4 w-4" />
                                重置密码
                              </DropdownMenu.Item>
                              {(isUserLocked(user) || user.failedLoginCount > 0) ? (
                                <DropdownMenu.Item
                                  className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-amber-700 outline-none hover:bg-amber-50 focus:bg-amber-50"
                                  onSelect={() => void handleUnlockUser(user)}
                                >
                                  <RefreshCcw className="h-4 w-4" />
                                  {isUserLocked(user) ? "解除锁定" : "清空失败"}
                                </DropdownMenu.Item>
                              ) : null}
                              <DropdownMenu.Item
                                className={cn(
                                  "flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm outline-none",
                                  user.isActive
                                    ? "text-amber-700 hover:bg-amber-50 focus:bg-amber-50"
                                    : "text-primary hover:bg-emerald-50 focus:bg-emerald-50"
                                )}
                                onSelect={() => void handleToggleUserState(user)}
                              >
                                {user.isActive ? <ShieldAlert className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                                {user.isActive ? "停用账号" : "启用账号"}
                              </DropdownMenu.Item>
                              <DropdownMenu.Separator className="my-1 h-px bg-border" />
                              <DropdownMenu.Item
                                className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive outline-none hover:bg-destructive/10 focus:bg-destructive/10 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50"
                                disabled={user.isActive}
                                onSelect={() => void handleDeleteUser(user)}
                              >
                                <Trash2 className="h-4 w-4" />
                                删除用户
                              </DropdownMenu.Item>
                            </DropdownMenu.Content>
                          </DropdownMenu.Portal>
                        </DropdownMenu.Root>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3 border-t border-border/60 pt-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p>搜索、角色和状态视角会实时生效，列表默认按创建时间倒序排列。</p>
            <p>停用会立即回收现有会话；解除锁定会同步清空失败记录；安全告警会按多 IP、多会话和失败登录自动汇总。</p>
          </div>
          <div className="flex gap-2">
            <button
              className="rounded-lg border border-border bg-background px-4 py-2 font-medium disabled:opacity-40"
              disabled={pagination.page <= 1 || loading}
              onClick={() => void loadUsers({ page: pagination.page - 1 })}
              type="button"
            >
              上一页
            </button>
            <button
              className="rounded-lg border border-border bg-background px-4 py-2 font-medium disabled:opacity-40"
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
            <label className="block text-sm text-foreground">
              用户名
              <input
                className="mt-2 w-full rounded-lg border border-border bg-muted/40 px-3 py-2"
                onChange={(event) => setCreateForm((current) => ({ ...current, username: event.target.value }))}
                placeholder="请输入用户名"
                value={createForm.username}
              />
            </label>
            <button
              className="mt-7 rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground"
              onClick={generateUsername}
              type="button"
            >
              自动生成
            </button>
          </div>

          <label className="block text-sm text-foreground">
            邮箱
            <input
              className="mt-2 w-full rounded-lg border border-border bg-muted/40 px-3 py-2"
              onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="请输入邮箱"
              value={createForm.email}
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm text-foreground">
              角色
              <select
                className="mt-2 w-full rounded-lg border border-border bg-muted/40 px-3 py-2"
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

            <label className="block text-sm text-foreground">
              初始密码
              <input
                className="mt-2 w-full rounded-lg border border-border bg-muted/40 px-3 py-2"
                onChange={(event) => setCreateForm((current) => ({ ...current, password: event.target.value }))}
                placeholder="留空则自动生成"
                type="password"
                value={createForm.password}
              />
            </label>
          </div>

          <div className="flex justify-end gap-3">
            <button
              className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground"
              onClick={() => setCreateOpen(false)}
              type="button"
            >
              取消
            </button>
            <button
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
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
          <label className="block text-sm text-foreground">
            邮箱
            <input
              className="mt-2 w-full rounded-lg border border-border bg-muted/40 px-3 py-2"
              onChange={(event) => setEditForm((current) => ({ ...current, email: event.target.value }))}
              value={editForm.email}
            />
          </label>

          <label className="block text-sm text-foreground">
            角色
            <select
              className="mt-2 w-full rounded-lg border border-border bg-muted/40 px-3 py-2"
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
              className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground"
              onClick={() => setEditOpen(false)}
              type="button"
            >
              取消
            </button>
            <button
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              disabled={submitting}
              type="submit"
            >
              {submitting ? "保存中…" : "保存修改"}
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
            <div className="rounded-xl border border-border bg-muted/40 p-5">
              <p className="text-sm text-muted-foreground">用户名</p>
              <p className="mt-1 font-medium text-foreground">{resetPasswordData.username}</p>
              <p className="mt-4 text-sm text-muted-foreground">密码</p>
              <p className="mt-1 font-mono tabular-nums text-base text-foreground">{resetPasswordData.password}</p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground"
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
        onClose={() => {
          setHistoryOpen(false);
          setHistoryIpQuery("");
        }}
        open={historyOpen}
        title="登录记录"
      >
        {historyLoading ? (
          <p className="text-sm text-muted-foreground">正在加载登录记录...</p>
        ) : (
          <div className="space-y-3">
            {loginHistory.length ? (
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/80" />
                <input
                  className="w-full rounded-lg border border-border bg-muted/40 py-2 pl-9 pr-3 text-sm text-foreground"
                  onChange={(event) => setHistoryIpQuery(event.target.value)}
                  placeholder="按 IP 搜索登录记录"
                  value={historyIpQuery}
                />
              </label>
            ) : null}
            {filteredLoginHistory.length ? (
              filteredLoginHistory.map((record) => (
                <div className="rounded-xl border border-border bg-muted/40 p-4" key={record.id}>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          record.status === "active"
                            ? "bg-emerald-50 text-emerald-700"
                            : record.status === "expired"
                              ? "bg-stone-200 text-foreground"
                              : record.status === "locked"
                                ? "bg-destructive/10 text-destructive"
                                : record.status === "failed"
                                  ? "bg-amber-500/10 text-amber-600"
                              : "bg-amber-500/10 text-amber-600"
                        }`}
                      >
                        {getLoginHistoryStatusLabel(record)}
                      </span>
                      {record.sessionId ? (
                        <span className="text-xs text-muted-foreground">{record.sessionId.slice(0, 12)}...</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">{record.source === "audit" ? "审计事件" : "登录事件"}</span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {record.lastActivityAt
                        ? `最后活动：${formatDateTime(record.lastActivityAt)}`
                        : `记录时间：${formatDateTime(record.createdAt)}`}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                    <p>登录时间：{formatDateTime(record.createdAt)}</p>
                    <p>{record.expiresAt ? `过期时间：${formatDateTime(record.expiresAt)}` : `事件类型：${getLoginHistoryEventLabel(record.eventType)}`}</p>
                    <p>IP：{record.ipAddress || "--"}</p>
                    <p className="sm:col-span-2">设备：{record.userAgent || "--"}</p>
                    {record.failureReason ? (
                      <p className="sm:col-span-2">原因：{record.failureReason}</p>
                    ) : null}
                  </div>
                </div>
              ))
            ) : loginHistory.length ? (
              <EmptyState
                description="尝试输入更短的 IP 片段，或清空搜索查看全部记录。"
                icon={Search}
                title="没有匹配该 IP 的登录记录"
              />
            ) : (
              <EmptyState
                description="最近没有可展示的登录会话或审计事件。"
                icon={History}
                title="暂无登录记录"
              />
            )}
          </div>
        )}
      </ModalFrame>

      <ModalFrame
        description={alertsUser ? `查看 ${alertsUser.username} 当前的登录与会话风险。` : undefined}
        eyebrow="用户管理"
        onClose={() => setAlertsOpen(false)}
        open={alertsOpen}
        title="安全告警"
      >
        {alertsLoading ? (
          <p className="text-sm text-muted-foreground">正在分析安全告警...</p>
        ) : securityAlerts.length ? (
          <div className="space-y-5">
            {groupedSecurityAlerts.recent.length ? (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">最近 7 天</p>
                {groupedSecurityAlerts.recent.map((alert) => (
                  <div
                    className={`rounded-xl border p-4 ${
                      alert.severity === "critical"
                        ? "border-destructive/20 bg-destructive/10"
                        : alert.severity === "warning"
                          ? "border-amber-200 bg-amber-500/10"
                          : "border-border bg-muted/40"
                    }`}
                    key={alert.id}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={getAlertSeverityBadgeClass(alert.severity)}>
                            {getAlertSeverityLabel(alert.severity)}
                          </span>
                          <span className="text-xs text-muted-foreground">{formatDateTime(alert.createdAt)}</span>
                        </div>
                        <p className="mt-3 text-sm font-semibold text-foreground">{alert.title}</p>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">{alert.description}</p>
                      </div>
                      <div className="rounded-lg bg-background/80 px-3 py-2 text-xs font-medium text-muted-foreground">
                        {getAlertCategoryLabel(alert.category)}
                      </div>
                    </div>

                    {alert.evidence.length ? (
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {alert.evidence.map((item) => (
                          <div className="rounded-lg bg-background/80 px-3 py-3" key={`${alert.id}-${item.label}`}>
                            <p className="text-xs text-muted-foreground">{item.label}</p>
                            <p className="mt-1 text-sm font-medium text-foreground">{item.value}</p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}

            {groupedSecurityAlerts.older.length ? (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">更早</p>
                {groupedSecurityAlerts.older.map((alert) => (
                  <div
                    className={`rounded-xl border p-4 ${
                      alert.severity === "critical"
                        ? "border-destructive/20 bg-destructive/10"
                        : alert.severity === "warning"
                          ? "border-amber-200 bg-amber-500/10"
                          : "border-border bg-muted/40"
                    }`}
                    key={alert.id}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={getAlertSeverityBadgeClass(alert.severity)}>
                            {getAlertSeverityLabel(alert.severity)}
                          </span>
                          <span className="text-xs text-muted-foreground">{formatDateTime(alert.createdAt)}</span>
                        </div>
                        <p className="mt-3 text-sm font-semibold text-foreground">{alert.title}</p>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">{alert.description}</p>
                      </div>
                      <div className="rounded-lg bg-background/80 px-3 py-2 text-xs font-medium text-muted-foreground">
                        {getAlertCategoryLabel(alert.category)}
                      </div>
                    </div>

                    {alert.evidence.length ? (
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {alert.evidence.map((item) => (
                          <div className="rounded-lg bg-background/80 px-3 py-3" key={`${alert.id}-${item.label}`}>
                            <p className="text-xs text-muted-foreground">{item.label}</p>
                            <p className="mt-1 text-sm font-medium text-foreground">{item.value}</p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <EmptyState
            description="最近没有检测到高失败登录、多地点活跃会话或异常分散的登录来源。"
            icon={ShieldAlert}
            title="暂无安全告警"
          />
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

function getUserStatusBadge(user: AdminUser): { label: string; variant: StatusBadgeVariant } {
  if (!user.isActive) {
    return { label: "已停用", variant: "disabled" };
  }

  if (isUserLocked(user)) {
    const remainingMinutes = getUserLockMinutes(user.lockedUntil);
    return {
      label: remainingMinutes > 0 ? `已锁定 · ${remainingMinutes} 分钟` : "已锁定",
      variant: "warning"
    };
  }

  return { label: "正常", variant: "success" };
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

function getUserRowClassName(user: AdminUser) {
  if (!user.isActive) {
    return "border-b border-border/40 bg-destructive/5 align-top transition hover:bg-destructive/10 last:border-b-0";
  }

  if (isUserLocked(user) || user.failedLoginCount > 0) {
    return "border-b border-border/40 bg-amber-50/70 align-top transition hover:bg-amber-100/70 last:border-b-0";
  }

  if (user.activeSessionCount > 0) {
    return "border-b border-border/40 bg-emerald-50/45 align-top transition hover:bg-emerald-100/60 last:border-b-0";
  }

  return "border-b border-border/40 align-top transition hover:bg-muted/30 last:border-b-0";
}

function getLoginHistoryStatusLabel(record: LoginRecord) {
  if (record.status === "active") {
    return "登录成功";
  }

  if (record.status === "expired") {
    return "会话已过期";
  }

  if (record.status === "revoked") {
    return "会话已撤销";
  }

  if (record.status === "locked") {
    return "触发锁定";
  }

  return "登录失败";
}

function getLoginHistoryEventLabel(eventType: LoginRecord["eventType"]) {
  if (eventType === "login_success") {
    return "登录成功";
  }

  if (eventType === "account_locked") {
    return "账号锁定";
  }

  return "登录失败";
}

function getAlertSeverityBadgeClass(severity: SecurityAlert["severity"]) {
  if (severity === "critical") {
    return "rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-destructive";
  }

  if (severity === "warning") {
    return "rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-600";
  }

  return "rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary";
}

function getAlertSeverityLabel(severity: SecurityAlert["severity"]) {
  if (severity === "critical") {
    return "严重";
  }

  if (severity === "warning") {
    return "警告";
  }

  return "提示";
}

function getAlertCategoryLabel(category: SecurityAlert["category"]) {
  switch (category) {
    case "lockout":
      return "锁定";
    case "failed-login":
      return "失败登录";
    case "active-session-spread":
      return "活跃会话";
    case "recent-ip-spread":
      return "来源 IP";
    case "recent-device-spread":
      return "设备类型";
    default:
      return "安全";
  }
}

function OverviewFilterCard(props: {
  label: string;
  value: string;
  description: string;
  tone: "emerald" | "amber" | "slate";
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "rounded-xl border p-4 text-left transition",
        props.selected
          ? "border-emerald-300 bg-primary/5 shadow-[0_12px_30px_rgba(5,150,105,0.08)]"
          : "border-border bg-muted/30 hover:border-emerald-200 hover:bg-background"
      )}
      onClick={props.onClick}
      type="button"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{props.label}</p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">{props.description}</p>
        </div>
        <span
          className={cn(
            "rounded-full px-3 py-1 text-xs font-semibold",
            props.tone === "emerald"
              ? "bg-primary/10 text-primary"
              : props.tone === "amber"
                ? "bg-amber-500/10 text-amber-600"
                : "bg-muted text-foreground"
          )}
        >
          {props.value}
        </span>
      </div>
    </button>
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
      ? "border-destructive/20 bg-destructive/10 text-destructive disabled:border-red-100 disabled:bg-destructive/10/60"
      : props.tone === "emerald"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700 disabled:border-emerald-100 disabled:bg-emerald-50/60"
        : props.tone === "amber"
          ? "border-amber-200 bg-amber-500/10 text-amber-600 disabled:border-amber-100 disabled:bg-amber-500/60"
          : "border-border bg-background text-foreground";

  return (
    <button
      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${toneClass}`}
      disabled={props.disabled}
      onClick={props.onClick}
      type="button"
    >
      <Icon className="h-3.5 w-3.5" />
      {props.label}
    </button>
  );
}
