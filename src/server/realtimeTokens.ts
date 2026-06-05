import crypto from "crypto";
import type { TimerControlMode } from "../config/timer";

const SESSION_SETTINGS_TOKEN_DURATION_MS = 8 * 60 * 60 * 1000;

function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD || "shazam!";
}

function getPartyKitSecret(): string {
  return process.env.PARTYKIT_ADMIN_SECRET || getAdminPassword();
}

function signPayload(payload: object): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", getPartyKitSecret())
    .update(encodedPayload)
    .digest("base64url");

  return `${encodedPayload}.${signature}`;
}

export function createPartyKitSessionSettingsToken(
  sessionId: string,
  timerControlMode: TimerControlMode,
  sessionUpdatedAt: string
): string {
  return signPayload({
    type: "session-settings",
    sessionId,
    timerControlMode,
    sessionUpdatedAt,
    exp: Date.now() + SESSION_SETTINGS_TOKEN_DURATION_MS,
  });
}
