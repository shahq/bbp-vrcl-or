import * as admin from "../admin";
import type { AdminAuthProvider } from "../backend/types";
import { createPartyKitSessionSettingsToken } from "../realtimeTokens";

export const passwordAdminAuthProvider: AdminAuthProvider = {
  cleanupExpiredSessions: admin.cleanupExpiredSessions,
  verifyAdminPassword: admin.verifyAdminPassword,
  createAdminSession: admin.createAdminSession,
  deleteAdminSession: admin.deleteAdminSession,
  isAdminAuthenticated: admin.isAdminAuthenticated,
  requireAdminAuth: admin.requireAdminAuth,
  createPartyKitAdminToken: admin.createPartyKitAdminToken,
  createPartyKitSessionSettingsToken: ({ sessionId, timerControlMode, sessionUpdatedAt }) =>
    createPartyKitSessionSettingsToken(sessionId, timerControlMode, sessionUpdatedAt),
};
