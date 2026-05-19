import * as legacyAdmin from "../admin";
import type { AdminAuthProvider } from "../backend/types";

export const passwordAdminAuthProvider: AdminAuthProvider = {
  cleanupExpiredSessions: legacyAdmin.cleanupExpiredSessions,
  verifyAdminPassword: legacyAdmin.verifyAdminPassword,
  createAdminSession: legacyAdmin.createAdminSession,
  deleteAdminSession: legacyAdmin.deleteAdminSession,
  isAdminAuthenticated: legacyAdmin.isAdminAuthenticated,
  requireAdminAuth: legacyAdmin.requireAdminAuth,
  createPartyKitAdminToken: legacyAdmin.createPartyKitAdminToken,
};

