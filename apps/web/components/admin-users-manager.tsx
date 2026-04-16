"use client";

import { useEffect, useState } from "react";

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
  Search,
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
  }>(`/api/admin/users?${params.toString()}`);
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

  async function loadUsers(input?: AdminUsersQuery) {
    setLoading(true);
    setError("");
    const result = await requestAdminUsers({
      page: input?.page || 1,
      limit: input?.limit || pagination.limit,
      searchQuery: input?.searchQuery ?? searchQuery,
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
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      void requestAdminUsers({
        page: 1,
        limit: pagination.limit,
        searchQuery,
        roleFilter,
        sortField,
        sortDirection
      }).then((result) => {
        if (!result.success) {
          setError(result.userMessage);
          setLoading(false);
          return;
        }

        setUsers(result.data.users || []);
        setPagination((current) => result.data.pagination || current);
        setLoading(false);
      });
    }, 220);

    return () => window.clearTimeout(timer);
  }, [pagination.limit, roleFilter, searchQuery, sortDirection, sortField]);

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
    if (!window.confirm(`确定要删除用户“${user.username}”吗？此操作不可恢复。`)) {
      return;
    }

    const result = await fetchJson<{ success: boolean }>(`/api/admin/users/${user.id}`, {
      method: "DELETE"
    });
    if (!result.success) {
      setError(result.userMessage);
      return;
    }

    setMessage("用户已删除");
    await loadUsers({
      page: Math.min(pagination.page, Math.max(1, pagination.totalPages))
    });
  }

  async function handleResetPassword(user: AdminUser) {
    if (!window.confirm(`确定要重置用户“${user.username}”的密码吗？`)) {
      return;
    }

    const result = await fetchJson<{ username: string; newPassword: string }>(
      `/api/admin/users/${user.id}/reset-password`,
      { method: "POST" }
    );
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
    setMessage("密码已重置");
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

  return (
    <div className="space-y-6">
      <section className="surface-panel p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="eyebrow">Admin</p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-900">用户管理</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              集中管理后台账号、角色分配、登录记录和密码重置，页面结构与 autobb 的用户管理台保持一致。
            </p>
          </div>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-emerald px-5 py-3 text-sm font-semibold text-white"
            onClick={() => setCreateOpen(true)}
            type="button"
          >
            <Plus className="h-4 w-4" />
            新建用户
          </button>
        </div>
      </section>

      <section className="surface-panel p-6">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
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
        </div>

        {message ? <p className="mt-4 text-sm text-emerald-700">{message}</p> : null}
        {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr className="border-b border-brand-line/70">
                <SortableHeader field="username" label="用户" onSort={handleSort} renderIcon={renderSortIcon} />
                <SortableHeader field="email" label="邮箱" onSort={handleSort} renderIcon={renderSortIcon} />
                <SortableHeader field="role" label="角色" onSort={handleSort} renderIcon={renderSortIcon} />
                <th className="pb-3">会话</th>
                <SortableHeader field="lastLoginAt" label="上次活动" onSort={handleSort} renderIcon={renderSortIcon} />
                <SortableHeader field="createdAt" label="创建时间" onSort={handleSort} renderIcon={renderSortIcon} />
                <th className="pb-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="py-8 text-slate-500" colSpan={7}>
                    正在加载用户列表...
                  </td>
                </tr>
              ) : null}

              {emptyState ? (
                <tr>
                  <td className="py-8 text-slate-500" colSpan={7}>
                    当前筛选条件下没有用户。
                  </td>
                </tr>
              ) : null}

              {!loading
                ? users.map((user) => (
                    <tr className="border-b border-brand-line/40 align-top" key={user.id}>
                      <td className="py-4 pr-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-mist text-sm font-semibold text-brand-emerald">
                            {user.username.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{user.username}</p>
                            <p className="text-xs text-slate-500">ID {user.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 pr-4 text-slate-700">{user.email}</td>
                      <td className="py-4 pr-4">
                        <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-slate-700">
                          {user.role === "admin" ? "管理员" : "普通用户"}
                        </span>
                      </td>
                      <td className="py-4 pr-4 text-slate-700">
                        {user.activeSessionCount > 0 ? `${user.activeSessionCount} 个活跃会话` : "暂无活跃会话"}
                      </td>
                      <td className="py-4 pr-4 text-slate-700">{formatDateTime(user.lastLoginAt)}</td>
                      <td className="py-4 pr-4 text-slate-700">{formatDateTime(user.createdAt)}</td>
                      <td className="py-4">
                        <div className="flex flex-wrap justify-end gap-2">
                          <ActionButton icon={PencilLine} label="编辑" onClick={() => openEditModal(user)} />
                          <ActionButton icon={KeyRound} label="重置密码" onClick={() => void handleResetPassword(user)} />
                          <ActionButton icon={History} label="登录记录" onClick={() => void handleLoadLoginHistory(user)} />
                          <ActionButton
                            icon={Trash2}
                            label="删除"
                            danger
                            onClick={() => void handleDeleteUser(user)}
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
          <p>
            共 {pagination.total} 个用户，当前第 {pagination.page} / {pagination.totalPages} 页
          </p>
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

function ActionButton(props: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  const Icon = props.icon;

  return (
    <button
      className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-semibold ${
        props.danger
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-brand-line bg-white text-slate-700"
      }`}
      onClick={props.onClick}
      type="button"
    >
      <Icon className="h-3.5 w-3.5" />
      {props.label}
    </button>
  );
}
