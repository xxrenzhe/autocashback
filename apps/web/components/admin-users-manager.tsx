"use client";

import { useEffect, useState } from "react";

import { fetchJson } from "@/lib/api-error-handler";

type AdminUser = {
  id: number;
  username: string;
  email: string;
  role: string;
  created_at: string;
};

const initialForm = {
  username: "",
  email: "",
  password: "",
  role: "user"
};

export function AdminUsersManager() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");

  async function loadUsers() {
    const result = await fetchJson<{ users: AdminUser[] }>("/api/admin/users");
    if (!result.success) {
      setMessage(result.userMessage);
      return;
    }

    setUsers(result.data.users || []);
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await fetchJson<{ user?: AdminUser }>("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    setMessage(result.success ? "用户已创建" : result.userMessage);
    if (result.success) {
      setForm(initialForm);
      await loadUsers();
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px,1fr]">
      <form className="surface-panel p-6" onSubmit={handleSubmit}>
        <p className="eyebrow">管理员创建账号</p>
        <div className="mt-5 space-y-4">
          <input
            className="w-full rounded-2xl border border-brand-line bg-stone-50 px-4 py-3"
            placeholder="用户名"
            value={form.username}
            onChange={(event) => setForm({ ...form, username: event.target.value })}
          />
          <input
            className="w-full rounded-2xl border border-brand-line bg-stone-50 px-4 py-3"
            placeholder="邮箱"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
          />
          <input
            className="w-full rounded-2xl border border-brand-line bg-stone-50 px-4 py-3"
            placeholder="初始密码"
            type="password"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
          />
          <select
            className="w-full rounded-2xl border border-brand-line bg-stone-50 px-4 py-3"
            value={form.role}
            onChange={(event) => setForm({ ...form, role: event.target.value })}
          >
            <option value="user">user</option>
            <option value="admin">admin</option>
          </select>
        </div>
        <button className="mt-5 rounded-2xl bg-brand-emerald px-5 py-3 text-sm font-semibold text-white" type="submit">
          创建用户
        </button>
        {message ? <p className="mt-3 text-sm text-slate-600">{message}</p> : null}
      </form>

      <div className="surface-panel p-6">
        <p className="eyebrow">用户列表</p>
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="pb-3">用户名</th>
                <th className="pb-3">邮箱</th>
                <th className="pb-3">角色</th>
                <th className="pb-3">创建时间</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr className="border-t border-brand-line/60" key={user.id}>
                  <td className="py-4 font-medium text-slate-900">{user.username}</td>
                  <td className="py-4">{user.email}</td>
                  <td className="py-4">{user.role}</td>
                  <td className="py-4">{user.created_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
