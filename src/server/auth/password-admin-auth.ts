import * as admin from "../admin";
import type { AdminAuthProvider } from "../backend/types";

export const passwordAdminAuthProvider: AdminAuthProvider = {
  cleanupExpiredSessions: admin.cleanupExpiredSessions,
  verifyAdminPassword: admin.verifyAdminPassword,
  createAdminSession: admin.createAdminSession,
  deleteAdminSession: admin.deleteAdminSession,
  isAdminAuthenticated: admin.isAdminAuthenticated,
  requireAdminAuth: admin.requireAdminAuth,
  createPartyKitAdminToken: admin.createPartyKitAdminToken,
  createPartyKitSessionSettingsToken: admin.createPartyKitSessionSettingsToken,
};
