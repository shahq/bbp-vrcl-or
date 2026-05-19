import { apiUrl } from "../config/api";

export interface AdminLoginResult {
  sessionId: string;
  expiresAt: string;
}

export async function loginWithAdminPassword(password: string): Promise<AdminLoginResult> {
  const response = await fetch(apiUrl("/api/admin/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });

  if (!response.ok) {
    let errorMessage = "Invalid password";
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorMessage;
    } catch {
      errorMessage = await response.text() || errorMessage;
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

export async function logoutAdminSession(sessionId: string): Promise<void> {
  await fetch(apiUrl("/api/admin/logout"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
  });
}

export async function checkAdminSession(sessionId: string): Promise<boolean> {
  const response = await fetch(apiUrl("/api/admin/check"), {
    headers: { "x-admin-session": sessionId },
  });

  if (!response.ok) {
    return false;
  }

  const data = await response.json();
  return Boolean(data.isAuthenticated);
}

