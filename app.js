import { calculateRecoveryMinutes, formatClock, recoveryActivity } from "./recovery.js";
import { clearCloudSessions, onAuthChange, resendVerification, signIn, signOut, signUp, syncSessions } from "./cloud.js";

const STORAGE_KEY = "luwes-focus-v1";
const DAY_KEY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" });
const $ = (id) => document.getElementById(id);

const elements = {
  clock: $("clock"), clockCaption: $("clockCaption"), modeLabel: $("modeLabel"), modeTitle: $("modeTitle"),
  modeDescription: $("modeDescription"), taskInput: $("taskInput"), primaryButton: $("primaryButton"),
  primaryText: $("primaryText"), primaryIcon: $("primaryIcon"), finishButton: $("finishButton"),
  recoveryHeading: $("recoveryHeading"), recoveryMinutes: $("recoveryMinutes"), focusBasis: $("focusBasis"),
  recoveryAdvice: $("recoveryAdvice"), recoveryProgress: $("recoveryProgress"), clearHistory: $("clearHistory"),
  notificationButton: $("notificationButton"), toast: $("toast"), openBreakdown: $("openBreakdown"),
  breakdownDialog: $("breakdownDialog"), closeBreakdown: $("closeBreakdown"),
  consistencyDays: $("consistencyDays"), consistencyDots: $("consistencyDots"),
  consistencyStreak: $("consistencyStreak"), consistencyToday: $("consistencyToday"),
  breakdownCurrentStreak: $("breakdownCurrentStreak"), breakdownBestStreak: $("breakdownBestStreak"),
  breakdownAverage: $("breakdownAverage"), weekTotal: $("weekTotal"), trendChart: $("trendChart"),
  trendSummary: $("trendSummary"), activityCount: $("activityCount"), profileHistory: $("profileHistory"),
  calculatorHours: $("calculatorHours"), calculatorMinutes: $("calculatorMinutes"),
  calculatorBreak: $("calculatorBreak"), calculationLine: $("calculationLine"), calculationReason: $("calculationReason"),
  authView: $("authView"), appView: $("appView"), skipLink: $("skipLink"), syncDot: $("syncDot"),
  syncLabel: $("syncLabel"), authForm: $("authForm"), emailInput: $("emailInput"), passwordInput: $("passwordInput"),
  authError: $("authError"), signInButton: $("signInButton"), signUpButton: $("signUpButton"),
  resendVerificationButton: $("resendVerificationButton"), signOutButton: $("signOutButton"),
};

const blankState = () => ({
  mode: "idle", running: false, accumulatedMs: 0, activeSince: null, breakDurationMs: 0,
  task: "", sessions: [],
});

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return saved && ["idle", "focus", "break"].includes(saved.mode)
      ? { ...blankState(), ...saved, sessions: Array.isArray(saved.sessions) ? saved.sessions : [] }
      : blankState();
  } catch { return blankState(); }
}

let state = loadState();
let toastTimer;
let currentUser = null;
let syncing = false;
let syncPending = false;

function elapsed(now = Date.now()) {
  return state.accumulatedMs + (state.running && state.activeSince ? now - state.activeSince : 0);
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

async function syncCloud({ quiet = false } = {}) {
  if (!currentUser) return;
  if (syncing) {
    syncPending = true;
    return;
  }
  syncing = true;
  renderAuthState("syncing");
  try {
    state.sessions = await syncSessions(state.sessions, currentUser.id);
    save();
    render();
    renderAuthState("synced");
    if (!quiet) showToast("Session history synced.");
  } catch (error) {
    console.error(error);
    renderAuthState("error");
    if (!quiet) showToast("Sync failed. Your local data is still safe.");
  } finally {
    syncing = false;
    if (syncPending) {
      syncPending = false;
      syncCloud({ quiet: true });
    }
  }
}

function renderAuthState(status = currentUser ? "synced" : "signed-out") {
  const signedIn = Boolean(currentUser);
  elements.authView.hidden = signedIn;
  elements.appView.hidden = !signedIn;
  document.body.classList.toggle("auth-screen", !signedIn);
  elements.skipLink.href = signedIn ? "#main" : "#authForm";
  elements.skipLink.textContent = signedIn ? "Skip to timer" : "Skip to sign in";
  elements.syncDot.className = status;
  elements.syncLabel.textContent = status === "syncing" ? "Syncing…" : status === "error" ? "Sync retry needed" : "Synced";
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 3200);
}

function announce(title, body) {
  beep();
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body, tag: "focus-timer" });
  }
}

function beep() {
  try {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 660;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.13, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.35);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.36);
  } catch { /* Sound is optional. */ }
}

function startOrResume() {
  if (state.mode === "idle") {
    state.mode = "focus";
    state.accumulatedMs = 0;
    state.task = elements.taskInput.value.trim();
  }
  state.running = true;
  state.activeSince = Date.now();
  save();
  render();
}

function pause() {
  state.accumulatedMs = elapsed();
  state.running = false;
  state.activeSince = null;
  save();
  render();
}

function finishFocus() {
  const focusMs = elapsed();
  if (focusMs < 10_000) {
    showToast("That was very short. Focus for at least 10 seconds first.");
    return;
  }
  const breakMinutes = calculateRecoveryMinutes(focusMs);
  state.sessions.unshift({
    id: Date.now(), date: new Date().toISOString(), task: state.task.trim() || "Untitled session",
    focusMs, recoveryMs: breakMinutes * 60_000, actualRecoveryMs: 0,
  });
  state.sessions = state.sessions.slice(0, 50);
  state.mode = "break";
  state.running = true;
  state.accumulatedMs = 0;
  state.activeSince = Date.now();
  state.breakDurationMs = breakMinutes * 60_000;
  save();
  syncCloud({ quiet: true });
  announce("Time to recover", `${breakMinutes} minutes. ${recoveryActivity(focusMs)}`);
  render();
}

function finishBreak(completed = false) {
  const actual = Math.min(elapsed(), state.breakDurationMs);
  if (state.sessions[0]) state.sessions[0].actualRecoveryMs = actual;
  state = { ...state, mode: "idle", running: false, accumulatedMs: 0, activeSince: null, breakDurationMs: 0, task: "" };
  save();
  syncCloud({ quiet: true });
  if (completed) announce("Recovery complete", "Start another session whenever you are ready.");
  else showToast("Recovery ended. Start again whenever you are ready.");
  render();
}

function toggleTimer() {
  if (state.running) pause(); else startOrResume();
}

function render(now = Date.now()) {
  const currentElapsed = elapsed(now);
  const isBreak = state.mode === "break";
  const isFocus = state.mode === "focus";
  document.body.classList.toggle("break-mode", isBreak);

  if (isBreak) {
    const remaining = Math.max(0, state.breakDurationMs - currentElapsed);
    elements.clock.textContent = formatClock(remaining);
    elements.modeLabel.textContent = state.running ? "RECOVERY IN PROGRESS" : "RECOVERY PAUSED";
    elements.modeTitle.textContent = "Take a real break.";
    elements.modeDescription.textContent = recoveryActivity(state.sessions[0]?.focusMs || 0);
    elements.clockCaption.textContent = `${Math.round(state.breakDurationMs / 60_000)} minutes from your last focus session`;
    elements.primaryText.textContent = state.running ? "Pause recovery" : "Resume recovery";
    elements.finishButton.hidden = false;
    elements.finishButton.querySelector("span").textContent = "End recovery";
    elements.recoveryHeading.textContent = "RECOVERY IN PROGRESS";
    elements.recoveryMinutes.textContent = Math.ceil(remaining / 60_000);
    elements.focusBasis.textContent = `${formatClock(currentElapsed)} elapsed`;
    elements.recoveryAdvice.textContent = recoveryActivity(state.sessions[0]?.focusMs || 0);
    elements.recoveryProgress.style.width = `${Math.min(100, currentElapsed / state.breakDurationMs * 100)}%`;
    elements.taskInput.disabled = true;
    if (remaining <= 0 && state.running) finishBreak(true);
  } else {
    elements.clock.textContent = formatClock(currentElapsed);
    elements.modeLabel.textContent = isFocus ? (state.running ? "FOCUS IN PROGRESS" : "FOCUS PAUSED") : "READY WHEN YOU ARE";
    elements.modeTitle.textContent = isFocus ? (state.running ? "Stay with it." : "Focus paused.") : "Ready when you are.";
    elements.modeDescription.textContent = isFocus
      ? "Keep going while the work still feels productive. Your recovery adapts when you finish."
      : "Start without choosing an end time.";
    elements.clockCaption.textContent = "timer counts up";
    elements.primaryText.textContent = isFocus ? (state.running ? "Pause focus" : "Resume focus") : "Start focusing";
    elements.finishButton.hidden = !isFocus;
    elements.finishButton.querySelector("span").textContent = "Finish focus";
    const recovery = calculateRecoveryMinutes(currentElapsed);
    elements.recoveryHeading.textContent = "RECOVERY IF YOU STOP NOW";
    elements.recoveryMinutes.textContent = recovery;
    elements.focusBasis.textContent = currentElapsed >= 60_000 ? `${Math.floor(currentElapsed / 60_000)}m focused` : "starting minimum";
    elements.recoveryAdvice.textContent = recoveryActivity(currentElapsed);
    elements.recoveryProgress.style.width = `${Math.min(100, recovery / 30 * 100)}%`;
    elements.taskInput.disabled = false;
    if (document.activeElement !== elements.taskInput && elements.taskInput.value !== state.task) elements.taskInput.value = state.task;
  }

  elements.primaryIcon.innerHTML = state.running ? '<path d="M8 5v14M16 5v14"/>' : '<path d="m8 5 11 7-11 7z"/>';
  document.title = state.mode === "idle"
    ? "Focus timer — no forced cutoff"
    : `${elements.clock.textContent} · ${isBreak ? "Recover" : "Focus"}`;
  renderInsights();
}

function renderInsights() {
  const todayKey = DAY_KEY.format(new Date());
  const today = state.sessions.filter((session) => DAY_KEY.format(new Date(session.date)) === todayKey);
  const activeFocusMs = state.mode === "focus" ? elapsed() : 0;
  const todayFocusMs = today.reduce((sum, session) => sum + session.focusMs, 0) + activeFocusMs;
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Date.now() - (6 - index) * 86_400_000);
    const key = DAY_KEY.format(date);
    const completedFocusMs = state.sessions
      .filter((session) => DAY_KEY.format(new Date(session.date)) === key)
      .reduce((sum, session) => sum + session.focusMs, 0);
    return {
      key, date, focusMs: completedFocusMs + (key === todayKey ? activeFocusMs : 0),
      label: new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "Asia/Jakarta" }).format(date),
    };
  });
  const maxFocus = Math.max(...days.map((day) => day.focusMs), 1);
  const weekFocus = days.reduce((sum, day) => sum + day.focusMs, 0);
  const strongestDay = days.reduce((best, day) => day.focusMs > best.focusMs ? day : best, days[0]);
  const activeDays = days.filter((day) => day.focusMs > 0).length;
  const activeKeys = new Set(state.sessions.filter((session) => session.focusMs > 0).map((session) => DAY_KEY.format(new Date(session.date))));
  if (activeFocusMs > 0) activeKeys.add(todayKey);
  const currentStreak = calculateCurrentStreak(activeKeys, todayKey);
  const bestStreak = calculateBestStreak(activeKeys);
  const averageSession = state.sessions.length
    ? state.sessions.reduce((sum, session) => sum + session.focusMs, 0) / state.sessions.length
    : 0;

  elements.consistencyDays.textContent = `${activeDays} / 7`;
  elements.consistencyToday.textContent = formatDuration(todayFocusMs);
  elements.consistencyStreak.textContent = formatDays(currentStreak);
  elements.consistencyDots.replaceChildren(...days.map((day) => {
    const dot = document.createElement("span");
    dot.className = day.focusMs > 0 ? "active" : "";
    dot.classList.toggle("today", day.key === todayKey);
    dot.title = `${day.label}: ${formatDuration(day.focusMs)}`;
    return dot;
  }));
  elements.consistencyDots.setAttribute("aria-label", `${activeDays} active days in the last seven days`);
  elements.breakdownCurrentStreak.textContent = formatDays(currentStreak);
  elements.breakdownBestStreak.textContent = formatDays(bestStreak);
  elements.breakdownAverage.textContent = formatDuration(averageSession);
  elements.clearHistory.hidden = state.sessions.length === 0;

  elements.weekTotal.textContent = `${formatDuration(weekFocus)} total`;
  elements.trendChart.replaceChildren(...days.map((day) => {
    const li = document.createElement("li");
    const value = document.createElement("span");
    const track = document.createElement("div");
    const bar = document.createElement("span");
    const label = document.createElement("span");
    value.className = "trend-value";
    track.className = "trend-track";
    bar.className = "trend-bar";
    label.className = "trend-day";
    value.textContent = formatDuration(day.focusMs);
    label.textContent = day.label;
    bar.style.height = `${day.focusMs ? Math.max(4, day.focusMs / maxFocus * 100) : 0}%`;
    track.append(bar);
    li.append(value, track, label);
    li.classList.toggle("today", day.key === todayKey);
    li.setAttribute("aria-label", `${day.label}: ${formatDuration(day.focusMs)} focused`);
    return li;
  }));
  const exactTrend = days.map((day) => `${day.label} ${formatDuration(day.focusMs)}`).join(", ");
  elements.trendChart.setAttribute("aria-label", `Daily focus for the last seven days: ${exactTrend}`);
  elements.trendSummary.textContent = weekFocus
    ? `Your strongest day was ${strongestDay.label} with ${formatDuration(strongestDay.focusMs)} of focus.`
    : "Complete a session to start your trend.";

  elements.activityCount.textContent = `${state.sessions.length} ${state.sessions.length === 1 ? "session" : "sessions"}`;
  if (!state.sessions.length) {
    elements.profileHistory.innerHTML = '<li class="profile-empty">No activity yet. Finish a focus session and it will appear here.</li>';
  } else {
    elements.profileHistory.replaceChildren(...state.sessions.map((session) => {
      const li = document.createElement("li");
      const title = document.createElement("strong");
      const time = document.createElement("time");
      const duration = document.createElement("span");
      title.textContent = session.task;
      time.dateTime = session.date;
      time.textContent = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(session.date));
      duration.className = "profile-duration";
      duration.textContent = `${formatDuration(session.focusMs)} focus · ${formatDuration(session.actualRecoveryMs || 0)} break`;
      li.append(title, time, duration);
      return li;
    }));
  }
}

function calculateCurrentStreak(activeKeys, todayKey) {
  const cursor = dateFromDayKey(todayKey);
  if (!activeKeys.has(todayKey)) cursor.setUTCDate(cursor.getUTCDate() - 1);
  let streak = 0;
  while (activeKeys.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

function calculateBestStreak(activeKeys) {
  const keys = [...activeKeys].sort();
  let best = 0;
  let run = 0;
  let previous = null;
  keys.forEach((key) => {
    const date = dateFromDayKey(key);
    run = previous && (date - previous) / 86_400_000 === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    previous = date;
  });
  return best;
}

function dateFromDayKey(key) {
  return new Date(`${key}T00:00:00Z`);
}

function formatDays(days) {
  return `${days} ${days === 1 ? "day" : "days"}`;
}

function updateCalculator() {
  const hours = Math.min(24, Math.max(0, Number.parseInt(elements.calculatorHours.value, 10) || 0));
  const minutes = Math.min(59, Math.max(0, Number.parseInt(elements.calculatorMinutes.value, 10) || 0));
  const totalMinutes = hours * 60 + minutes;
  if (!totalMinutes) {
    elements.calculatorBreak.textContent = "0";
    elements.calculationLine.textContent = "Enter a planned focus duration";
    elements.calculationReason.textContent = "Recovery will be calculated from the same formula used by the timer.";
    return;
  }
  const rawRecovery = totalMinutes * 0.2;
  const recovery = calculateRecoveryMinutes(totalMinutes * 60_000);
  const rawLabel = Number.isInteger(rawRecovery) ? rawRecovery : rawRecovery.toFixed(1);
  elements.calculatorBreak.textContent = recovery;
  elements.calculationLine.textContent = `${formatPlan(totalMinutes)} × 20% = ${rawLabel}m → ${recovery}m`;
  if (rawRecovery < 3) elements.calculationReason.textContent = "The 3-minute minimum applies to very short sessions.";
  else if (rawRecovery > 30) elements.calculationReason.textContent = "The 30-minute cap keeps recovery from taking over the day.";
  else if (!Number.isInteger(rawRecovery)) elements.calculationReason.textContent = "The result is rounded to the nearest whole minute.";
  else elements.calculationReason.textContent = "No limit or rounding adjustment is needed.";
}

function formatDuration(milliseconds) {
  const totalMinutes = Math.round(Math.max(0, milliseconds) / 60_000);
  if (!totalMinutes) return "0m";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours ? `${hours}h${minutes ? ` ${minutes}m` : ""}` : `${minutes}m`;
}

function formatPlan(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours ? `${hours}h${minutes ? ` ${minutes}m` : ""}` : `${minutes}m`;
}

elements.primaryButton.addEventListener("click", toggleTimer);
elements.openBreakdown.addEventListener("click", () => elements.breakdownDialog.showModal());
elements.closeBreakdown.addEventListener("click", () => elements.breakdownDialog.close());
elements.breakdownDialog.addEventListener("click", (event) => {
  if (event.target === elements.breakdownDialog) elements.breakdownDialog.close();
});
elements.calculatorHours.addEventListener("input", updateCalculator);
elements.calculatorMinutes.addEventListener("input", updateCalculator);
elements.finishButton.addEventListener("click", () => state.mode === "break" ? finishBreak(false) : finishFocus());
elements.taskInput.addEventListener("input", () => {
  if (state.mode === "break") return;
  state.task = elements.taskInput.value;
  save();
});
elements.clearHistory.addEventListener("click", () => {
  if (!confirm("Clear your entire session history? This cannot be undone.")) return;
  state.sessions = [];
  save();
  render();
  if (currentUser) {
    clearCloudSessions()
      .then(() => showToast("Session history cleared everywhere."))
      .catch(() => showToast("Local history cleared, but cloud deletion failed."));
  } else showToast("Session history cleared.");
});
elements.authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!elements.authForm.reportValidity()) return;
  elements.authError.textContent = "";
  elements.signInButton.disabled = true;
  elements.signInButton.textContent = "Signing in…";
  try { await signIn(elements.emailInput.value.trim(), elements.passwordInput.value); }
  catch (error) { elements.authError.textContent = error.message; }
  finally { elements.signInButton.disabled = false; elements.signInButton.textContent = "Sign in"; }
});
elements.signUpButton.addEventListener("click", async () => {
  if (!elements.authForm.reportValidity()) return;
  elements.authError.textContent = "";
  elements.signUpButton.disabled = true;
  try {
    const signedIn = await signUp(elements.emailInput.value.trim(), elements.passwordInput.value);
    if (!signedIn) elements.authError.textContent = "Account created. Check your email to confirm it, then sign in.";
  } catch (error) { elements.authError.textContent = error.message; }
  finally { elements.signUpButton.disabled = false; }
});
elements.resendVerificationButton.addEventListener("click", async () => {
  if (!elements.emailInput.reportValidity()) return;
  elements.authError.textContent = "";
  elements.resendVerificationButton.disabled = true;
  try {
    await resendVerification(elements.emailInput.value.trim());
    elements.authError.textContent = "Verification email sent. Use the newest link.";
  } catch (error) { elements.authError.textContent = error.message; }
  finally { elements.resendVerificationButton.disabled = false; }
});
elements.signOutButton.addEventListener("click", async () => {
  elements.signOutButton.disabled = true;
  try {
    if (state.running) pause();
    await signOut();
    showToast("Signed out.");
  } catch (error) { showToast(error.message); }
  finally { elements.signOutButton.disabled = false; }
});
elements.notificationButton.addEventListener("click", async () => {
  if (!("Notification" in window)) return showToast("This browser does not support notifications.");
  const permission = await Notification.requestPermission();
  elements.notificationButton.classList.toggle("active", permission === "granted");
  showToast(permission === "granted" ? "Notifications enabled." : "Notifications were not allowed.");
});
document.addEventListener("keydown", (event) => {
  if (elements.breakdownDialog.open) return;
  if (event.code !== "Space" || event.repeat || event.target.matches("input, button, summary, a")) return;
  event.preventDefault();
  toggleTimer();
});
document.addEventListener("visibilitychange", () => { if (!document.hidden) render(); });

elements.taskInput.value = state.task;
if ("Notification" in window) elements.notificationButton.classList.toggle("active", Notification.permission === "granted");
updateCalculator();
renderAuthState();
onAuthChange((session) => {
  const previousUserId = currentUser?.id;
  currentUser = session?.user || null;
  renderAuthState();
  if (currentUser && currentUser.id !== previousUserId) syncCloud({ quiet: true });
});
render();
setInterval(() => { if (state.mode !== "idle") render(); }, 500);
