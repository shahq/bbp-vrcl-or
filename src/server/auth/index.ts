import type { AdminAuthProvider } from "../backend/types";
import { passwordAdminAuthProvider } from "./password-admin-auth";

function createFirebasePlaceholderProvider(): AdminAuthProvider {
  const notImplemented = () => {
    throw new Error(
      "ADMIN_AUTH_PROVIDER=firebase is not implemented yet. Complete the Firebase Auth migration before enabling it."
    );
  };

  return {
    cleanupExpiredSessions: () => undefined,
    verifyAdminPassword: () => notImplemented(),
    createAdminSession: () => notImplemented(),
    deleteAdminSession: () => notImplemented(),
    isAdminAuthenticated: () => notImplemented(),
    requireAdminAuth: (_req, _res, _next) => notImplemented(),
    createPartyKitAdminToken: () => notImplemented(),
  };
}

export function getAdminAuthProvider(): AdminAuthProvider {
  const provider = process.env.ADMIN_AUTH_PROVIDER || "password";
  switch (provider) {
    case "password":
      return passwordAdminAuthProvider;
    case "firebase":
      return createFirebasePlaceholderProvider();
    default:
      throw new Error(`Unsupported ADMIN_AUTH_PROVIDER: ${provider}`);
  }
}
