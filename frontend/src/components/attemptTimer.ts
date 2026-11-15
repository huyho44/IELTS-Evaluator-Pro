export type AttemptTimerState =
  | {
      kind: "untimed";
      remainingSeconds: null;
      formatted: null;
      label: string;
    }
  | {
      kind: "expired";
      remainingSeconds: 0;
      formatted: "00:00";
      label: string;
    }
  | {
      kind: "urgent" | "running";
      remainingSeconds: number;
      formatted: string;
      label: string;
    };

export function resolveAttemptTimer(
  expiresAt: string | null | undefined,
  nowMs: number,
): AttemptTimerState {
  if (!expiresAt) {
    return {
      kind: "untimed",
      remainingSeconds: null,
      formatted: null,
      label: "No time limit",
    };
  }
  const targetMs = new Date(expiresAt).getTime();
  if (!Number.isFinite(targetMs)) {
    return {
      kind: "untimed",
      remainingSeconds: null,
      formatted: null,
      label: "No time limit",
    };
  }
  const diffMs = targetMs - nowMs;
  if (diffMs <= 0) {
    return {
      kind: "expired",
      remainingSeconds: 0,
      formatted: "00:00",
      label: "Time limit expired",
    };
  }
  const remainingSeconds = Math.ceil(diffMs / 1000);
  const hours = Math.floor(remainingSeconds / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  const formatted =
    hours > 0
      ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
      : `${pad(minutes)}:${pad(seconds)}`;
  return {
    kind: remainingSeconds <= 60 ? "urgent" : "running",
    remainingSeconds,
    formatted,
    label: `Time remaining · ${formatted}`,
  };
}
