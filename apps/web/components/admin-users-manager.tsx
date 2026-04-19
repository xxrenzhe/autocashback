"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronLeft,
  ChevronRight,
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
}> = [
  {
    value: "all",
    label: "全部账号"
  },
  {
    value: "risk",
    label: "风险账号"
  },
  {
    value: "locked",
    label: "已锁定"
  },
  {
    value: "disabled",
    label: "已停用"
  },
  {
    value: "active-session",
    label: "活跃会话"
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
    setSelectedUser(user);
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

  const summary = useMemo(() => {
    const lockedCount = users.filter((user) => isUserLocked(user)).length;
    const disabledCount = users.filter((user) => !user.isActive).length;
    const activeSessionUsersCount = users.filter((user) => user.activeSessionCount > 0).length;
    const riskCount = users.filter(
      (user) => !user.isActive || isUserLocked(user) || user.failedLoginCount > 0
    ).length;

    return {
      lockedCount,
      disabledCount,
      activeSessionUsersCount,
      riskCount
    };
  }, [users]);

  const hasFilters = Boolean(searchQuery.trim()) || roleFilter !== "all" || statusFilter !== "all";
  const visibleStart = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const visibleEnd = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <div className="space-y-8 p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="page-title">用户管理</h1>
          <p className="page-subtitle">管理系统用户、访问状态与登录风险。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-3.5 py-2 text-sm font-medium text-foreground transition hover:border-foreground/20 hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading}
            onClick={() => void loadUsers({ page: pagination.page })}
            type="button"
          >
            <RefreshCcw className={cnIcon(loading)} />
            刷新列表
          </button>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:opacity-95"
            onClick={() => setCreateOpen(true)}
            type="button"
          >
            <Plus className="h-4 w-4" />
            新建用户
          </button>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
        <div className="border-b border-border px-6 py-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-base font-semibold text-foreground">账号列表</p>
              <p className="mt-1 text-sm text-muted-foreground">
                风险 {summary.riskCount} 个，锁定 {summary.lockedCount} 个，停用 {summary.disabledCount} 个，活跃会话 {summary.activeSessionUsersCount} 个
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span>共 {pagination.total} 个用户</span>
              <span>第 {pagination.page} / {Math.max(1, pagination.totalPages)} 页</span>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center">
              <label className="relative flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/80" />
                <input
                  className="w-full rounded-lg border border-border bg-background py-2.5 pl-11 pr-4 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="搜索用户名或邮箱"
                  value={searchQuery}
                />
              </label>

              <select
                className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                onChange={(event) => setRoleFilter(event.target.value as "all" | "admin" | "user")}
                value={roleFilter}
              >
                <option value="all">所有角色</option>
                <option value="admin">管理员</option>
                <option value="user">普通用户</option>
              </select>

              <select
                className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                value={statusFilter}
              >
                {STATUS_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <select
                className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                onChange={(event) => void loadUsers({ page: 1, limit: Number(event.target.value || 10) })}
                value={pagination.limit}
              >
                <option value="10">10 / 页</option>
                <option value="20">20 / 页</option>
                <option value="50">50 / 页</option>
                <option value="100">100 / 页</option>
              </select>
            </div>

            {hasFilters ? (
              <button
                className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition hover:border-foreground/20 hover:bg-muted/60"
                onClick={() => {
                  setSearchQuery("");
                  setRoleFilter("all");
                  setStatusFilter("all");
                  void loadUsers({
                    page: 1,
                    limit: pagination.limit,
                    roleFilter: "all",
                    statusFilter: "all",
                    searchQuery: ""
                  });
                }}
                type="button"
              >
                清空筛选
              </button>
            ) : null}
          </div>
        </div>

        {loading ? (
          <TableSkeleton className="m-6" rows={Math.min(8, pagination.limit)} />
        ) : emptyState ? (
          <EmptyState className="m-6" icon={Search} title="当前筛选条件下没有用户" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-max min-w-[1120px] table-fixed text-sm [&_th]:h-11 [&_th]:px-3 [&_td]:px-3 [&_td]:py-3">
              <thead className="border-b border-border bg-muted/30">
                <tr>
                  <th
                    className="hidden w-[78px] whitespace-nowrap text-left font-medium text-muted-foreground sm:table-cell"
                    aria-sort={sortField === "id" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                  >
                    <button className="inline-flex items-center gap-1 whitespace-nowrap" onClick={() => handleSort("id")} type="button">
                      用户 ID
                      {renderSortIcon("id")}
                    </button>
                  </th>
                  <th
                    className="w-[240px] whitespace-nowrap text-left font-medium text-muted-foreground"
                    aria-sort={sortField === "username" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                  >
                    <button className="inline-flex items-center gap-1 whitespace-nowrap" onClick={() => handleSort("username")} type="button">
                      用户
                      {renderSortIcon("username")}
                    </button>
                  </th>
                  <th
                    className="hidden w-[110px] whitespace-nowrap text-left font-medium text-muted-foreground lg:table-cell"
                    aria-sort={sortField === "role" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                  >
                    <button className="inline-flex items-center gap-1 whitespace-nowrap" onClick={() => handleSort("role")} type="button">
                      角色
                      {renderSortIcon("role")}
                    </button>
                  </th>
                  <th
                    className="w-[200px] whitespace-nowrap text-left font-medium text-muted-foreground"
                    aria-sort={sortField === "status" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                  >
                    <button className="inline-flex items-center gap-1 whitespace-nowrap" onClick={() => handleSort("status")} type="button">
                      状态
                      {renderSortIcon("status")}
                    </button>
                  </th>
                  <th className="w-[140px] whitespace-nowrap text-left font-medium text-muted-foreground">会话</th>
                  <th
                    className="hidden w-[180px] whitespace-nowrap text-left font-medium text-muted-foreground xl:table-cell"
                    aria-sort={sortField === "lastLoginAt" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                  >
                    <button className="inline-flex items-center gap-1 whitespace-nowrap" onClick={() => handleSort("lastLoginAt")} type="button">
                      上次登录
                      {renderSortIcon("lastLoginAt")}
                    </button>
                  </th>
                  <th
                    className="hidden w-[180px] whitespace-nowrap text-left font-medium text-muted-foreground xl:table-cell"
                    aria-sort={sortField === "createdAt" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                  >
                    <button className="inline-flex items-center gap-1 whitespace-nowrap" onClick={() => handleSort("createdAt")} type="button">
                      创建时间
                      {renderSortIcon("createdAt")}
                    </button>
                  </th>
                  <th className="w-[120px] whitespace-nowrap text-center font-medium text-muted-foreground">操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const userStatusBadge = getUserStatusBadge(user);

                  return (
                    <tr className={getUserRowClassName(user)} key={user.id}>
                      <td className="hidden font-mono text-xs text-muted-foreground sm:table-cell">{user.id}</td>
                      <td>
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                            {user.username.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-medium text-foreground">{user.username}</div>
                            <div className="truncate text-xs text-muted-foreground">{user.email || "未设置邮箱"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="hidden lg:table-cell">
                        <span
                          className={cn(
                            "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium",
                            user.role === "admin" ? "bg-amber-100 text-amber-700" : "bg-muted text-foreground"
                          )}
                        >
                          {user.role === "admin" ? "管理员" : "普通用户"}
                        </span>
                      </td>
                      <td>
                        <div className="flex flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <StatusBadge className="h-6 items-center px-2.5 text-[11px]" label={userStatusBadge.label} variant={userStatusBadge.variant} />
                            {user.failedLoginCount > 0 ? (
                              <span className="inline-flex h-6 items-center rounded-full bg-amber-500/10 px-2.5 text-[11px] font-medium text-amber-700">
                                失败 {user.failedLoginCount}
                              </span>
                            ) : null}
                          </div>
                          <p className="hidden text-[11px] leading-4 text-muted-foreground 2xl:block">{getUserRiskSummary(user)}</p>
                        </div>
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1.5">
                          <span className="inline-flex h-6 items-center rounded-full bg-muted px-2.5 text-[11px] font-medium text-muted-foreground">
                            {user.activeSessionCount > 0 ? `${user.activeSessionCount} 个会话` : "无会话"}
                          </span>
                          {!user.isActive ? (
                            <span className="inline-flex h-6 items-center rounded-full bg-destructive/10 px-2.5 text-[11px] font-medium text-destructive">
                              已停用
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="hidden text-sm text-foreground xl:table-cell">{formatDateTime(user.lastLoginAt)}</td>
                      <td className="hidden text-sm text-foreground xl:table-cell">{formatDateTime(user.createdAt)}</td>
                      <td>
                        <div className="flex items-center justify-center gap-1">
                          <IconActionButton className="hidden lg:inline-flex" disabled={actionLoading !== null} icon={PencilLine} label="编辑" onClick={() => openEditModal(user)} />
                          <IconActionButton className="hidden lg:inline-flex" disabled={actionLoading !== null} icon={KeyRound} label="重置密码" onClick={() => void handleResetPassword(user)} />
                          <DropdownMenu.Root>
                            <DropdownMenu.Trigger asChild>
                              <button
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={actionLoading !== null}
                                title="更多操作"
                                type="button"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                            </DropdownMenu.Trigger>
                            <DropdownMenu.Portal>
                              <DropdownMenu.Content
                                align="end"
                                className="z-50 w-72 rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg"
                                sideOffset={8}
                              >
                                <DropdownMenu.Item className={dropdownItemClassName} onSelect={() => void handleLoadLoginHistory(user)}>
                                  <MenuItemContent description="查看最近登录历史和失败记录" icon={History} title="查看登录记录" />
                                </DropdownMenu.Item>
                                <DropdownMenu.Item className={dropdownItemClassName} onSelect={() => void handleLoadSecurityAlerts(user)}>
                                  <MenuItemContent description="查看账户共享和异常使用风险" icon={ShieldAlert} iconClassName="text-amber-600" title="查看安全告警" />
                                </DropdownMenu.Item>
                                <DropdownMenu.Item className={dropdownItemClassName} onSelect={() => void handleResetPassword(user)}>
                                  <MenuItemContent description="生成新密码并清空现有会话" icon={KeyRound} title="重置密码" />
                                </DropdownMenu.Item>
                                {isUserLocked(user) || user.failedLoginCount > 0 ? (
                                  <DropdownMenu.Item className={cn(dropdownItemClassName, "text-amber-700 focus:bg-amber-50")} onSelect={() => void handleUnlockUser(user)}>
                                    <MenuItemContent
                                      description={isUserLocked(user) ? "解除当前登录锁定状态" : "清空失败登录计数"}
                                      icon={RefreshCcw}
                                      iconClassName="text-amber-600"
                                      title={isUserLocked(user) ? "立即解锁账户" : "清空失败记录"}
                                    />
                                  </DropdownMenu.Item>
                                ) : null}
                                <DropdownMenu.Item
                                  className={cn(
                                    dropdownItemClassName,
                                    user.isActive ? "text-amber-700 focus:bg-amber-50" : "text-primary focus:bg-emerald-50"
                                  )}
                                  onSelect={() => void handleToggleUserState(user)}
                                >
                                  <MenuItemContent
                                    description={user.isActive ? "禁用后该用户无法继续登录系统" : "恢复该用户的登录能力"}
                                    icon={user.isActive ? ShieldAlert : Check}
                                    iconClassName={user.isActive ? "text-amber-600" : "text-primary"}
                                    title={user.isActive ? "停用账户" : "启用账户"}
                                  />
                                </DropdownMenu.Item>
                                <DropdownMenu.Separator className="my-1 h-px bg-border" />
                                <DropdownMenu.Item
                                  className={cn(dropdownItemClassName, "text-destructive focus:bg-destructive/10")}
                                  disabled={user.isActive}
                                  onSelect={() => void handleDeleteUser(user)}
                                >
                                  <MenuItemContent
                                    description={user.isActive ? "需先停用该用户后才可删除" : "永久删除用户及其关联数据"}
                                    icon={Trash2}
                                    title="删除用户"
                                  />
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

        {pagination.total > 0 ? (
          <div className="flex flex-col gap-4 border-t border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span>
                显示 {visibleStart} - {visibleEnd} 条，共 {pagination.total} 条
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={pagination.page <= 1 || loading}
                onClick={() => void loadUsers({ page: pagination.page - 1 })}
                type="button"
              >
                <ChevronLeft className="h-4 w-4" />
                上一页
              </button>
              <div className="min-w-[92px] text-center text-sm text-muted-foreground">
                第 {pagination.page} / {Math.max(1, pagination.totalPages)} 页
              </div>
              <button
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={pagination.page >= pagination.totalPages || loading}
                onClick={() => void loadUsers({ page: pagination.page + 1 })}
                type="button"
              >
                下一页
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <ModalFrame
        description="创建新的系统账号，可选择角色并指定初始密码。"
        eyebrow="用户管理"
        onClose={() => setCreateOpen(false)}
        open={createOpen}
        title="新建用户"
      >
        <form className="space-y-5" onSubmit={handleCreateUser}>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              用户名
              <span className="ml-1 text-destructive">*</span>
            </label>
            <div className="grid gap-3 md:grid-cols-[1fr,auto]">
              <input
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                onChange={(event) => setCreateForm((current) => ({ ...current, username: event.target.value }))}
                placeholder="请输入用户名"
                value={createForm.username}
              />
              <button
                className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted/60"
                onClick={generateUsername}
                type="button"
              >
                自动生成
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">邮箱</label>
            <input
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
              onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="user@example.com"
              value={createForm.email}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">角色</label>
              <select
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
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
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">初始密码</label>
              <input
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                onChange={(event) => setCreateForm((current) => ({ ...current, password: event.target.value }))}
                placeholder="留空则自动生成"
                type="password"
                value={createForm.password}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted/60"
              onClick={() => setCreateOpen(false)}
              type="button"
            >
              取消
            </button>
            <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={submitting} type="submit">
              {submitting ? "创建中..." : "创建用户"}
            </button>
          </div>
        </form>
      </ModalFrame>

      <ModalFrame
        description="仅支持修改邮箱和角色，用户名保持不变。"
        eyebrow="用户管理"
        onClose={() => setEditOpen(false)}
        open={editOpen}
        title={selectedUser ? `编辑 ${selectedUser.username}` : "编辑用户"}
      >
        <form className="space-y-5" onSubmit={handleEditUser}>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">邮箱</label>
            <input
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
              onChange={(event) => setEditForm((current) => ({ ...current, email: event.target.value }))}
              value={editForm.email}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">角色</label>
            <select
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
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
          </div>

          <div className="flex justify-end gap-3">
            <button
              className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted/60"
              onClick={() => setEditOpen(false)}
              type="button"
            >
              取消
            </button>
            <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={submitting} type="submit">
              {submitting ? "保存中…" : "保存修改"}
            </button>
          </div>
        </form>
      </ModalFrame>

      <ModalFrame
        description="请将新的登录凭证发送给用户，首次登录需尽快修改密码。"
        eyebrow="用户管理"
        onClose={() => setResetPasswordOpen(false)}
        open={resetPasswordOpen}
        title="密码信息"
      >
        {resetPasswordData ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-muted/40 p-5 font-mono text-sm">
              <p>访问地址: {typeof window !== "undefined" ? window.location.origin : "--"}</p>
              <p className="mt-2">用户名: {resetPasswordData.username}</p>
              <p className="mt-2">
                密码: <span className="text-base font-semibold text-primary">{resetPasswordData.password}</span>
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted/60"
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
        description={
          selectedUser
            ? `${selectedUser.username} (${selectedUser.email || "无邮箱"}) 的最近登录历史`
            : "查看最近登录历史"
        }
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
                  className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
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
                    {record.failureReason ? <p className="sm:col-span-2">原因：{record.failureReason}</p> : null}
                  </div>
                </div>
              ))
            ) : loginHistory.length ? (
              <EmptyState icon={Search} title="没有匹配该 IP 的登录记录" />
            ) : (
              <EmptyState icon={History} title="暂无登录记录" />
            )}
          </div>
        )}
      </ModalFrame>

      <ModalFrame
        description={
          selectedUser
            ? `${selectedUser.username} (${selectedUser.email || "无邮箱"}) 的账户安全告警`
            : "查看账户安全告警"
        }
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
                          <span className={getAlertSeverityBadgeClass(alert.severity)}>{getAlertSeverityLabel(alert.severity)}</span>
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
                          <span className={getAlertSeverityBadgeClass(alert.severity)}>{getAlertSeverityLabel(alert.severity)}</span>
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
          <EmptyState icon={ShieldAlert} title="暂无安全告警" />
        )}
      </ModalFrame>
    </div>
  );
}

function cnIcon(loading: boolean) {
  return loading ? "h-4 w-4 animate-spin" : "h-4 w-4";
}

const dropdownItemClassName =
  "flex cursor-pointer items-start gap-2 rounded-lg px-3 py-2 text-sm outline-none transition hover:bg-muted focus:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50";

function MenuItemContent(props: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  iconClassName?: string;
}) {
  const Icon = props.icon;

  return (
    <>
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", props.iconClassName)} />
      <div className="space-y-0.5">
        <div className="font-medium">{props.title}</div>
        <div className="text-xs leading-4 text-muted-foreground">{props.description}</div>
      </div>
    </>
  );
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

function IconActionButton(props: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const Icon = props.icon;

  return (
    <button
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50",
        props.className
      )}
      disabled={props.disabled}
      onClick={props.onClick}
      title={props.label}
      type="button"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
