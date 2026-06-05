export type TimerControlMode = "admin" | "everyone";

export type TimerStatus = "idle" | "running" | "paused" | "finished";

export type TimerCommand =
  | { action: "set"; durationMs: number }
  | { action: "start" }
  | { action: "pause" }
  | { action: "reset" };

export interface SharedTimerState {
  controlMode: TimerControlMode;
  status: TimerStatus;
  durationMs: number;
  remainingMs: number;
  startedAt?: number;
  endsAt?: number;
  updatedAt: number;
  updatedBy?: string;
}

export const DEFAULT_TIMER_CONTROL_MODE: TimerControlMode = "admin";
export const DEFAULT_TIMER_DURATION_MS = 90 * 1000;
export const MAX_TIMER_DURATION_MS = ((90 * 60) + 59) * 1000;

export function normalizeTimerControlMode(value: unknown): TimerControlMode {
  return value === "everyone" ? "everyone" : DEFAULT_TIMER_CONTROL_MODE;
}

export function clampTimerDurationMs(durationMs: unknown): number {
  const parsed = Number(durationMs);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(MAX_TIMER_DURATION_MS, Math.round(parsed)));
}

export function createDefaultTimerState(
  controlMode: TimerControlMode = DEFAULT_TIMER_CONTROL_MODE,
  now = Date.now()
): SharedTimerState {
  return {
    controlMode,
    status: "idle",
    durationMs: DEFAULT_TIMER_DURATION_MS,
    remainingMs: DEFAULT_TIMER_DURATION_MS,
    updatedAt: now,
  };
}

export function getTimerRemainingMs(timer: SharedTimerState, now = Date.now()): number {
  if (timer.status === "running" && timer.endsAt) {
    return Math.max(0, timer.endsAt - now);
  }

  return clampTimerDurationMs(timer.remainingMs);
}

export function deriveTimerSnapshot(timer: SharedTimerState, now = Date.now()): SharedTimerState {
  const remainingMs = getTimerRemainingMs(timer, now);
  if (timer.status === "running" && remainingMs === 0) {
    return {
      ...timer,
      status: "finished",
      remainingMs: 0,
    };
  }

  return {
    ...timer,
    remainingMs,
  };
}

export function applyTimerCommand(
  timer: SharedTimerState,
  command: TimerCommand,
  updatedBy: string | undefined,
  now = Date.now()
): SharedTimerState {
  switch (command.action) {
    case "set": {
      const durationMs = clampTimerDurationMs(command.durationMs);
      return {
        controlMode: timer.controlMode,
        status: "idle",
        durationMs,
        remainingMs: durationMs,
        updatedAt: now,
        updatedBy,
      };
    }

    case "start": {
      const remainingMs = getTimerRemainingMs(timer, now) || clampTimerDurationMs(timer.durationMs);
      if (remainingMs <= 0) {
        return {
          ...timer,
          status: "idle",
          remainingMs: 0,
          updatedAt: now,
          updatedBy,
        };
      }

      return {
        ...timer,
        status: "running",
        remainingMs,
        startedAt: now,
        endsAt: now + remainingMs,
        updatedAt: now,
        updatedBy,
      };
    }

    case "pause": {
      const remainingMs = getTimerRemainingMs(timer, now);
      return {
        ...timer,
        status: remainingMs > 0 ? "paused" : "finished",
        remainingMs,
        startedAt: undefined,
        endsAt: undefined,
        updatedAt: now,
        updatedBy,
      };
    }

    case "reset":
      return {
        ...timer,
        status: "idle",
        remainingMs: clampTimerDurationMs(timer.durationMs),
        startedAt: undefined,
        endsAt: undefined,
        updatedAt: now,
        updatedBy,
      };
  }
}
