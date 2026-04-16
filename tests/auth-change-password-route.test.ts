import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  changeUserPassword,
  createUserSession,
  getAuthCookieName,
  logAuditEvent,
  revokeAllUserSessions
} = vi.hoisted(() => ({
  changeUserPassword: vi.fn(),
  createUserSession: vi.fn(),
  getAuthCookieName: vi.fn(),
  logAuditEvent: vi.fn(),
  revokeAllUserSessions: vi.fn()
}));

const { getRequestAuth } = vi.hoisted(() => ({
  getRequestAuth: vi.fn()
}));

const { getRequestMetadata } = vi.hoisted(() => ({
  getRequestMetadata: vi.fn()
}));

vi.mock("@autocashback/db", () => ({
  changeUserPassword,
  createUserSession,
  getAuthCookieName,
  logAuditEvent,
  revokeAllUserSessions
}));

vi.mock("@/lib/api-auth", () => ({
  getRequestAuth
}));

vi.mock("@/lib/request-metadata", () => ({
  getRequestMetadata
}));

import { POST } from "../apps/web/app/api/auth/change-password/route";

describe("change password route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthCookieName.mockReturnValue("autocashback_token");
    getRequestAuth.mockResolvedValue({
      user: {
        id: 7,
        role: "admin"
      }
    });
    getRequestMetadata.mockReturnValue({
      ipAddress: "127.0.0.1",
      userAgent: "vitest"
    });
    createUserSession.mockResolvedValue({
      token: "rotated-token"
    });
  });

  it("rotates sessions after password change", async () => {
    const response = await POST(
      new NextRequest("https://www.autocashback.dev/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: "OldPassword1",
          newPassword: "NewPassword1",
          confirmPassword: "NewPassword1"
        }),
        headers: {
          "Content-Type": "application/json"
        }
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(changeUserPassword).toHaveBeenCalledWith({
      userId: 7,
      currentPassword: "OldPassword1",
      newPassword: "NewPassword1"
    });
    expect(revokeAllUserSessions).toHaveBeenCalledWith(7);
    expect(createUserSession).toHaveBeenCalledWith(7, "admin", {
      ipAddress: "127.0.0.1",
      userAgent: "vitest"
    });
    expect(logAuditEvent).toHaveBeenCalled();
  });

  it("rejects weak passwords", async () => {
    const response = await POST(
      new NextRequest("https://www.autocashback.dev/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: "OldPassword1",
          newPassword: "short",
          confirmPassword: "short"
        }),
        headers: {
          "Content-Type": "application/json"
        }
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain("密码至少需要");
    expect(changeUserPassword).not.toHaveBeenCalled();
  });
});
