import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  createUser,
  deleteUserByAdmin,
  getUserSecurityAlertsByAdmin,
  listAdminUsers,
  listUserLoginHistoryByAdmin,
  logAuditEvent,
  resetUserPasswordByAdmin,
  updateUserByAdmin
} = vi.hoisted(() => ({
  createUser: vi.fn(),
  deleteUserByAdmin: vi.fn(),
  getUserSecurityAlertsByAdmin: vi.fn(),
  listAdminUsers: vi.fn(),
  listUserLoginHistoryByAdmin: vi.fn(),
  logAuditEvent: vi.fn(),
  resetUserPasswordByAdmin: vi.fn(),
  updateUserByAdmin: vi.fn()
}));

const { getRequestUser } = vi.hoisted(() => ({
  getRequestUser: vi.fn()
}));

vi.mock("@autocashback/db", () => ({
  createUser,
  deleteUserByAdmin,
  getUserSecurityAlertsByAdmin,
  listAdminUsers,
  listUserLoginHistoryByAdmin,
  logAuditEvent,
  resetUserPasswordByAdmin,
  updateUserByAdmin
}));

vi.mock("@/lib/api-auth", () => ({
  getRequestUser
}));

import { GET as listUsers, POST as createAdminUser } from "../apps/web/app/api/admin/users/route";
import {
  DELETE as deleteUser,
  PATCH as updateUser
} from "../apps/web/app/api/admin/users/[id]/route";
import { GET as getAlerts } from "../apps/web/app/api/admin/users/[id]/alerts/route";
import { GET as getLoginHistory } from "../apps/web/app/api/admin/users/[id]/login-history/route";
import { POST as resetPassword } from "../apps/web/app/api/admin/users/[id]/reset-password/route";

describe("admin users routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequestUser.mockResolvedValue({ id: 1, role: "admin", username: "admin" });
    listAdminUsers.mockResolvedValue({
      users: [
        {
          id: 7,
          username: "swiftfox101",
          email: "swiftfox101@example.com",
          role: "user",
          createdAt: "2026-04-16T12:00:00.000Z",
          lastLoginAt: "2026-04-16T12:30:00.000Z",
          activeSessionCount: 1,
          isActive: true,
          lockedUntil: null,
          failedLoginCount: 0
        }
      ],
      pagination: {
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1
      }
    });
    createUser.mockResolvedValue({
      id: 7,
      username: "swiftfox101",
      email: "swiftfox101@example.com",
      role: "user",
      created_at: "2026-04-16T12:00:00.000Z"
    });
    updateUserByAdmin.mockResolvedValue({
      id: 7,
      username: "swiftfox101",
      email: "next@example.com",
      role: "admin",
      createdAt: "2026-04-16T12:00:00.000Z",
      isActive: false,
      lockedUntil: null,
      failedLoginCount: 0
    });
    deleteUserByAdmin.mockResolvedValue({
      id: 7,
      username: "swiftfox101",
      role: "user"
    });
    resetUserPasswordByAdmin.mockResolvedValue({
      userId: 7,
      username: "swiftfox101",
      password: "TempPass123"
    });
    listUserLoginHistoryByAdmin.mockResolvedValue([
      {
        sessionId: "session-1",
        ipAddress: "127.0.0.1",
        userAgent: "Mozilla/5.0",
        createdAt: "2026-04-16T12:00:00.000Z",
        lastActivityAt: "2026-04-16T12:30:00.000Z",
        expiresAt: "2026-04-23T12:00:00.000Z",
        revokedAt: null,
        status: "active"
      }
    ]);
    getUserSecurityAlertsByAdmin.mockResolvedValue([
      {
        id: "failed-login-7",
        severity: "warning",
        category: "failed-login",
        title: "近期失败登录偏高",
        description: "最近 24 小时失败登录次数偏高。",
        createdAt: "2026-04-16T12:35:00.000Z",
        evidence: [
          { label: "当前失败记录", value: "3" },
          { label: "24 小时失败次数", value: "4" }
        ]
      }
    ]);
    logAuditEvent.mockResolvedValue(undefined);
  });

  it("lists admin users with query params", async () => {
    const response = await listUsers(
      new NextRequest("https://www.autocashback.dev/api/admin/users?page=2&limit=20&search=swift&role=user&sortBy=username&sortOrder=asc")
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(listAdminUsers).toHaveBeenCalledWith({
      page: 2,
      limit: 20,
      search: "swift",
      role: "user",
      sortBy: "username",
      sortOrder: "asc"
    });
    expect(payload.users[0].username).toBe("swiftfox101");
  });

  it("creates admin user and returns generated password", async () => {
    const response = await createAdminUser(
      new NextRequest("https://www.autocashback.dev/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          username: "swiftfox101",
          email: "swiftfox101@example.com",
          role: "user"
        }),
        headers: {
          "Content-Type": "application/json"
        }
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        username: "swiftfox101",
        email: "swiftfox101@example.com",
        role: "user"
      })
    );
    expect(payload.user.username).toBe("swiftfox101");
    expect(typeof payload.defaultPassword).toBe("string");
    expect(payload.defaultPassword.length).toBeGreaterThan(0);
  });

  it("updates a user profile", async () => {
    const response = await updateUser(
      new NextRequest("https://www.autocashback.dev/api/admin/users/7", {
        method: "PATCH",
        body: JSON.stringify({
          email: "next@example.com",
          role: "admin",
          isActive: false,
          unlock: true
        }),
        headers: {
          "Content-Type": "application/json"
        }
      }),
      { params: { id: "7" } }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(updateUserByAdmin).toHaveBeenCalledWith(7, {
      email: "next@example.com",
      role: "admin",
      isActive: false,
      unlock: true
    });
    expect(payload.user.role).toBe("admin");
  });

  it("prevents disabling the current logged-in admin", async () => {
    const response = await updateUser(
      new NextRequest("https://www.autocashback.dev/api/admin/users/1", {
        method: "PATCH",
        body: JSON.stringify({
          isActive: false
        }),
        headers: {
          "Content-Type": "application/json"
        }
      }),
      { params: { id: "1" } }
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("不能停用当前登录账号");
    expect(updateUserByAdmin).not.toHaveBeenCalled();
  });

  it("returns reset password result", async () => {
    const response = await resetPassword(
      new NextRequest("https://www.autocashback.dev/api/admin/users/7/reset-password", {
        method: "POST"
      }),
      { params: { id: "7" } }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(resetUserPasswordByAdmin).toHaveBeenCalledWith(7);
    expect(payload.newPassword).toBe("TempPass123");
  });

  it("returns login history records", async () => {
    const response = await getLoginHistory(
      new NextRequest("https://www.autocashback.dev/api/admin/users/7/login-history?limit=50"),
      { params: { id: "7" } }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(listUserLoginHistoryByAdmin).toHaveBeenCalledWith(7, 50);
    expect(payload.records).toHaveLength(1);
  });

  it("returns security alerts for a user", async () => {
    const response = await getAlerts(
      new NextRequest("https://www.autocashback.dev/api/admin/users/7/alerts"),
      { params: { id: "7" } }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(getUserSecurityAlertsByAdmin).toHaveBeenCalledWith(7);
    expect(payload.alerts[0].title).toBe("近期失败登录偏高");
  });

  it("prevents deleting current logged-in admin", async () => {
    const response = await deleteUser(
      new NextRequest("https://www.autocashback.dev/api/admin/users/1", {
        method: "DELETE"
      }),
      { params: { id: "1" } }
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("不能删除当前登录账号");
    expect(deleteUserByAdmin).not.toHaveBeenCalled();
  });
});
