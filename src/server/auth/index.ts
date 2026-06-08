import { passwordAdminAuthProvider } from "./password-admin-auth";
import type { AdminAuthProvider } from "../backend/types";

function getAdminAuthProviderName() {
  return process.env.ADMIN_AUTH_PROVIDER?.trim().toLowerCase() || "password";
}

export function getAdminAuthProvider(): AdminAuthProvider {
  const provider = getAdminAuthProviderName();
  switch (provider) {
    case "password":
      return passwordAdminAuthProvider;
    default:
      throw new Error(`Unsupported ADMIN_AUTH_PROVIDER: ${provider}`);
  }
}
