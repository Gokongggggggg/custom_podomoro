export const RECOVERY_RATIO = 0.2;
export const MIN_BREAK_MINUTES = 3;
export const MAX_BREAK_MINUTES = 30;

export function calculateRecoveryMinutes(focusMilliseconds) {
  const focusMinutes = Math.max(0, focusMilliseconds / 60_000);
  return Math.min(
    MAX_BREAK_MINUTES,
    Math.max(MIN_BREAK_MINUTES, Math.round(focusMinutes * RECOVERY_RATIO)),
  );
}

export function recoveryActivity(focusMilliseconds) {
  const minutes = focusMilliseconds / 60_000;
  if (minutes >= 90) return "Take a short walk, hydrate, and give your eyes a real screen break.";
  if (minutes >= 50) return "Stand up, move your body, and look into the distance.";
  return "Step away from the task: breathe, hydrate, or stretch lightly.";
}

export function formatClock(milliseconds, includeHours = false) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [minutes, seconds];
  if (includeHours || hours > 0) parts.unshift(hours);
  return parts.map((part) => String(part).padStart(2, "0")).join(":");
}
