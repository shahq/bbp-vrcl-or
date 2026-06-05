import type { Card } from "../../cards";
import type { Connection } from "../../connections";
import type { Session } from "../../sessions";
import { normalizeTimerControlMode } from "../../../config/timer";

export function sessionDocToModel(
  id: string,
  data: Record<string, any> | undefined
): Session | null {
  if (!data) return null;

  return {
    id,
    name: data.name ?? "",
    password_hash: data.password_hash ?? null,
    created_at: data.created_at ?? new Date().toISOString(),
    updated_at: data.updated_at ?? new Date().toISOString(),
    project_client: data.project_client ?? "",
    project_background: data.project_background ?? "",
    project_notes: data.project_notes ?? "",
    onboarding_completed: Boolean(data.onboarding_completed),
    is_archived: Boolean(data.is_archived),
    timer_control_mode: normalizeTimerControlMode(data.timer_control_mode),
  };
}

export function cardDocToModel(
  id: string,
  sessionId: string,
  data: Record<string, any> | undefined
): Card | null {
  if (!data) return null;

  return {
    id,
    session_id: sessionId,
    section: data.section ?? "",
    file_path: data.file_path ?? "",
    order_index: Number(data.order_index ?? 0),
    starred: Boolean(data.starred),
    created_at: data.created_at ?? new Date().toISOString(),
    updated_at: data.updated_at ?? new Date().toISOString(),
    content: data.content ?? "",
  };
}

export function connectionDocToModel(
  id: string,
  sessionId: string,
  data: Record<string, any> | undefined
): Connection | null {
  if (!data) return null;

  return {
    id,
    session_id: sessionId,
    from_card_id: data.from_card_id ?? data.from ?? "",
    to_card_id: data.to_card_id ?? data.to ?? "",
    thread_id: data.thread_id ?? data.threadId ?? null,
    color: data.color ?? null,
    owner_user_id: data.owner_user_id ?? data.ownerUserId ?? null,
    created_at: data.created_at ?? new Date().toISOString(),
  };
}
