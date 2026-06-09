import React, {
  ReactNode,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import {
  FileText,
  Play,
  Pause,
  RotateCcw,
  X,
  ExternalLink,
} from "lucide-react";
import { HELP_RESOURCES, TutorialItem } from "../tutorials";
import {
  DEFAULT_TIMER_DURATION_MS,
  getTimerRemainingMs,
  type SharedTimerState,
  type TimerCommand,
} from "../config/timer";

interface TopBarProps {
  children?: ReactNode;
  projectName?: string;
  rightContent?: ReactNode;
  onTimerComplete?: () => void;
  onTutorialSelect?: (tutorial: TutorialItem) => void;
  showTitle?: boolean;
  showTimer?: boolean;
  sharedTimer?: SharedTimerState;
  canControlTimer?: boolean;
  onTimerCommand?: (command: TimerCommand) => void;
}

export default function TopBar({
  children,
  projectName,
  rightContent,
  onTimerComplete,
  onTutorialSelect,
  showTitle = true,
  showTimer = true,
  sharedTimer,
  canControlTimer = true,
  onTimerCommand,
}: TopBarProps) {
  const defaultTimerMinutes = Math.floor(DEFAULT_TIMER_DURATION_MS / 60000);
  const defaultTimerSeconds = Math.floor((DEFAULT_TIMER_DURATION_MS % 60000) / 1000);
  const [minutes, setMinutes] = useState(defaultTimerMinutes);
  const [seconds, setSeconds] = useState(defaultTimerSeconds);
  const [lastSetTime, setLastSetTime] = useState({
    minutes: defaultTimerMinutes,
    seconds: defaultTimerSeconds,
  });
  const [isRunning, setIsRunning] = useState(false);
  const [timerNow, setTimerNow] = useState(Date.now());
  const [editingField, setEditingField] = useState<
    "minutes" | "seconds" | null
  >(null);
  const [editValue, setEditValue] = useState("");
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sharedCompletionRef = useRef<number | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const helpRef = useRef<HTMLDivElement>(null);

  const handleHelpResourceClick = (resource: (typeof HELP_RESOURCES)[number]) => {
    if (resource.kind === "video") {
      onTutorialSelect?.(resource);
      setShowHelp(false);
      return;
    }

    if (resource.url) {
      window.open(resource.url, "_blank", "noopener,noreferrer");
      setShowHelp(false);
    }
  };

  const playAlertSound = useCallback(() => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext ||
          (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.value = 800;
      oscillator.type = "sine";

      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.5);

      setTimeout(() => {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.frequency.value = 1000;
        osc2.type = "sine";
        gain2.gain.setValueAtTime(0.3, ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc2.start(ctx.currentTime);
        osc2.stop(ctx.currentTime + 0.5);
      }, 200);
    } catch (e) {
      console.warn("Could not play alert sound:", e);
    }
  }, []);

  const isSharedTimer = Boolean(sharedTimer && onTimerCommand);
  const sharedRemainingMs = sharedTimer ? getTimerRemainingMs(sharedTimer, timerNow) : 0;
  const displayTotalSeconds = isSharedTimer
    ? Math.ceil(sharedRemainingMs / 1000)
    : (minutes * 60) + seconds;
  const displayMinutes = Math.floor(displayTotalSeconds / 60);
  const displaySeconds = displayTotalSeconds % 60;
  const displayIsRunning = isSharedTimer
    ? sharedTimer?.status === "running" && sharedRemainingMs > 0
    : isRunning;
  const timerControlsDisabled = isSharedTimer && !canControlTimer;
  const timerTitle = isSharedTimer
    ? "Live timer: everyone can control"
    : "Local timer";

  useEffect(() => {
    if (!isSharedTimer || sharedTimer?.status !== "running") return;

    const tick = window.setInterval(() => setTimerNow(Date.now()), 250);
    return () => window.clearInterval(tick);
  }, [isSharedTimer, sharedTimer?.status, sharedTimer?.endsAt]);

  useEffect(() => {
    if (!isSharedTimer || !sharedTimer) return;

    const remainingMs = getTimerRemainingMs(sharedTimer, timerNow);
    if (sharedTimer.status === "running" && remainingMs === 0 && sharedCompletionRef.current !== sharedTimer.updatedAt) {
      sharedCompletionRef.current = sharedTimer.updatedAt;
      playAlertSound();
      onTimerComplete?.();
    }

    if (remainingMs > 0 || sharedTimer.status !== "running") {
      sharedCompletionRef.current = null;
    }
  }, [isSharedTimer, onTimerComplete, playAlertSound, sharedTimer, timerNow]);

  const handleStart = useCallback(() => {
    if (isSharedTimer) {
      if (displayTotalSeconds === 0 || timerControlsDisabled) return;
      onTimerCommand?.({ action: "start" });
      return;
    }

    if (minutes === 0 && seconds === 0) return;

    setLastSetTime({ minutes, seconds });
    setIsRunning(true);
  }, [displayTotalSeconds, isSharedTimer, minutes, onTimerCommand, seconds, timerControlsDisabled]);

  const handlePause = useCallback(() => {
    if (isSharedTimer) {
      if (timerControlsDisabled) return;
      onTimerCommand?.({ action: "pause" });
      return;
    }

    setIsRunning(false);
  }, [isSharedTimer, onTimerCommand, timerControlsDisabled]);

  const handleReset = useCallback(() => {
    if (isSharedTimer) {
      if (timerControlsDisabled) return;
      onTimerCommand?.({ action: "reset" });
      return;
    }

    setIsRunning(false);
    setMinutes(lastSetTime.minutes);
    setSeconds(lastSetTime.seconds);
  }, [isSharedTimer, lastSetTime, onTimerCommand, timerControlsDisabled]);

  const handlePlayPause = useCallback(() => {
    if (displayIsRunning) {
      handlePause();
    } else {
      handleStart();
    }
  }, [displayIsRunning, handleStart, handlePause]);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setSeconds((prev) => {
          if (prev === 0) {
            setMinutes((m) => {
              if (m === 0) {
                setIsRunning(false);
                playAlertSound();
                onTimerComplete?.();
                return 0;
              }
              return m - 1;
            });
            return minutes === 0 ? 0 : 59;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, playAlertSound, onTimerComplete, minutes]);

  const handleFieldClick = (field: "minutes" | "seconds") => {
    if (displayIsRunning || timerControlsDisabled) return;
    setEditingField(field);
    setEditValue(field === "minutes" ? String(displayMinutes) : String(displaySeconds));
  };

  const handleFieldBlur = () => {
    if (editingField) {
      const value = parseInt(editValue, 10) || 0;
      const max = editingField === "minutes" ? 90 : 59;
      const clamped = Math.max(0, Math.min(max, value));

      if (isSharedTimer) {
        const nextMinutes = editingField === "minutes" ? clamped : displayMinutes;
        const nextSeconds = editingField === "seconds" ? clamped : displaySeconds;
        onTimerCommand?.({
          action: "set",
          durationMs: ((nextMinutes * 60) + nextSeconds) * 1000,
        });
      } else if (editingField === "minutes") {
        setMinutes(clamped);
      } else {
        setSeconds(clamped);
      }
      setEditingField(null);
      setEditValue("");
    }
  };

  const handleFieldKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleFieldBlur();
    } else if (e.key === "Escape") {
      setEditingField(null);
      setEditValue("");
    }
  };

  const formatNumber = (n: number) => n.toString().padStart(2, "0");

  // Close help dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (helpRef.current && !helpRef.current.contains(e.target as Node)) {
        setShowHelp(false);
      }
    };
    if (showHelp) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showHelp]);

  return (
    <div className="h-16 bg-gray-50 border-b border-gray-200 flex items-center px-6 shrink-0">
      {/* Left: site brand */}
      <div className="flex items-center gap-3 pr-4 shrink-0">
        <span className="text-base font-bold text-black">SQD + BDO</span>
        <div className="w-px h-5 bg-gray-300" />
      </div>

      {/* Left: title */}
      {showTitle && (
        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
            WORKSHOP
          </div>
          <div className="text-sm font-medium text-gray-900 underline decoration-gray-300 underline-offset-4">
            Beyond Bulletpoints: The Unfair Advantage
          </div>
        </div>
      )}

      {/* Right: help, timer (conditional), action buttons, username / presence */}
      <div className="flex items-center gap-4 ml-auto">
        {/* Help / Tutorial entry point */}
        <div className="relative" ref={helpRef}>
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="p-2 rounded-full hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors"
            title="Help & Tutorials"
          >
            {showHelp ? (
              <X size={20} />
            ) : (
              <svg
                width="22"
                height="20"
                viewBox="0 0 44 40"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M19 29.9L26.96 25.34C28.3 24.58 28.3 22.64 26.96 21.86L19 17.3C17.66 16.54 16 17.52 16 19.04V28.14C16 29.68 17.66 30.66 19 29.9ZM40 7.6H24.82L30.7 1.72C31.1 1.32 31.1 0.7 30.7 0.3C30.3 -0.1 29.68 -0.1 29.28 0.3L22 7.58L14.72 0.3C14.32 -0.1 13.7 -0.1 13.3 0.3C12.9 0.7 12.9 1.32 13.3 1.72L19.18 7.6H4C1.8 7.6 0 9.38 0 11.6V35.6C0 37.8 1.8 39.6 4 39.6H40C42.2 39.6 44 37.8 44 35.6V11.6C44 9.38 42.2 7.6 40 7.6ZM38 35.6H6C4.9 35.6 4 34.7 4 33.6V13.6C4 12.5 4.9 11.6 6 11.6H38C39.1 11.6 40 12.5 40 13.6V33.6C40 34.7 39.1 35.6 38 35.6Z"
                  fill="currentColor"
                />
              </svg>
            )}
          </button>

          {showHelp && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                <h3 className="font-semibold text-gray-900">
                  Help & Tutorials
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Learn how to get the most from Beyond Bullet Points
                </p>
              </div>
              <div className="p-2">
                {HELP_RESOURCES.map((resource) => {
                  const isVideo = resource.kind === "video";
                  const isActionable = isVideo ? Boolean(resource.embedUrl || resource.url) : Boolean(resource.url);
                  const iconClassName = isVideo
                    ? "bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100"
                    : "bg-sky-50 text-sky-700 group-hover:bg-sky-100";

                  return (
                  <button
                    key={resource.id}
                    disabled={!isActionable}
                    onClick={() => {
                      handleHelpResourceClick(resource);
                    }}
                    className={`group w-full rounded-lg px-3 py-3 text-left transition-colors ${
                      isActionable ? "hover:bg-gray-50" : "cursor-default opacity-75"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconClassName}`}>
                          {isVideo ? <Play size={15} fill="currentColor" /> : <FileText size={16} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-gray-900 group-hover:text-indigo-700">
                            {resource.title}
                          </div>
                          <div className="mt-0.5 line-clamp-2 text-xs text-gray-500">
                            {resource.description}
                          </div>
                        </div>
                      </div>
                      <div className="ml-3 flex shrink-0 items-center gap-2">
                        {isVideo && resource.duration && (
                          <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                            {resource.duration}
                          </span>
                        )}
                        {!isVideo && resource.format && (
                          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                            {resource.format}
                          </span>
                        )}
                        {isActionable && (
                          <ExternalLink
                            size={12}
                            className="text-gray-400 group-hover:text-indigo-600"
                          />
                        )}
                      </div>
                    </div>
                  </button>
                  );
                })}
              </div>
              <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 text-[11px] text-gray-400 text-center">
                Help resource integration placeholder — swap source in
                tutorials.ts
              </div>
            </div>
          )}
        </div>

        {showTimer && (
          <div className="flex items-center bg-white border border-gray-200 rounded-full px-4 py-2 shadow-sm" title={timerTitle}>
            <button
              type="button"
              onClick={() => handleFieldClick("minutes")}
              disabled={displayIsRunning || timerControlsDisabled}
              className="text-sm font-bold mr-4 disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Set timer minutes"
            >
              Set Timer
            </button>
            <div className="flex items-center mr-6">
              {editingField === "minutes" ? (
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={editValue}
                  onChange={(e) =>
                    setEditValue(e.target.value.replace(/\D/g, "").slice(0, 2))
                  }
                  onBlur={handleFieldBlur}
                  onKeyDown={handleFieldKeyDown}
                  className="w-10 text-lg font-mono font-medium text-center border border-indigo-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                />
              ) : (
                <span
                  onClick={() => handleFieldClick("minutes")}
                  className={`text-lg font-mono font-medium cursor-pointer hover:text-indigo-600 ${displayIsRunning || timerControlsDisabled ? "cursor-not-allowed opacity-60" : ""}`}
                >
                  {formatNumber(displayMinutes)}
                </span>
              )}
              <span className="text-lg font-mono font-medium mx-1">:</span>
              {editingField === "seconds" ? (
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={editValue}
                  onChange={(e) =>
                    setEditValue(e.target.value.replace(/\D/g, "").slice(0, 2))
                  }
                  onBlur={handleFieldBlur}
                  onKeyDown={handleFieldKeyDown}
                  className="w-10 text-lg font-mono font-medium text-center border border-indigo-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                />
              ) : (
                <span
                  onClick={() => handleFieldClick("seconds")}
                  className={`text-lg font-mono font-medium cursor-pointer hover:text-indigo-600 ${displayIsRunning || timerControlsDisabled ? "cursor-not-allowed opacity-60" : ""}`}
                >
                  {formatNumber(displaySeconds)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-gray-500">
              <button
                onClick={handlePlayPause}
                className="hover:text-indigo-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={displayTotalSeconds === 0 || timerControlsDisabled}
              >
                {displayIsRunning ? (
                  <Pause size={16} fill="currentColor" />
                ) : (
                  <Play size={16} fill="currentColor" />
                )}
              </button>
              <button
                onClick={handleReset}
                className="hover:text-indigo-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={timerControlsDisabled}
              >
                <RotateCcw size={16} />
              </button>
            </div>
          </div>
        )}
        {rightContent}
        {children}
      </div>
    </div>
  );
}
