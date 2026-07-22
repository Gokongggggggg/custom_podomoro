import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://mvlwcifrsbcjlptjjyqe.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_2gRFFKRWHEZDPVQIZjGivA_gniQlGgy";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

export function onAuthChange(callback) {
  supabase.auth.getSession().then(({ data }) => callback(data.session));
  return supabase.auth.onAuthStateChange((_event, session) => callback(session));
}

export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return Boolean(data.session);
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

const toRow = (session, userId) => ({
  id: String(session.id), user_id: userId, started_at: session.date,
  task: session.task || "Untitled session", focus_ms: Math.round(session.focusMs),
  suggested_recovery_ms: Math.round(session.recoveryMs), actual_recovery_ms: Math.round(session.actualRecoveryMs || 0),
  updated_at: new Date().toISOString(),
});

const fromRow = (row) => ({
  id: row.id, date: row.started_at, task: row.task, focusMs: Number(row.focus_ms),
  recoveryMs: Number(row.suggested_recovery_ms), actualRecoveryMs: Number(row.actual_recovery_ms),
});

export async function syncSessions(localSessions, userId) {
  const { data: rows, error: readError } = await supabase.from("focus_sessions")
    .select("id, started_at, task, focus_ms, suggested_recovery_ms, actual_recovery_ms")
    .order("started_at", { ascending: false });
  if (readError) throw readError;
  const merged = new Map((rows || []).map((row) => [String(row.id), fromRow(row)]));
  for (const local of localSessions) {
    const remote = merged.get(String(local.id));
    merged.set(String(local.id), remote
      ? { ...remote, ...local, actualRecoveryMs: Math.max(remote.actualRecoveryMs || 0, local.actualRecoveryMs || 0) }
      : local);
  }
  const sessions = [...merged.values()].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 500);
  if (sessions.length) {
    const { error } = await supabase.from("focus_sessions").upsert(sessions.map((session) => toRow(session, userId)), { onConflict: "id" });
    if (error) throw error;
  }
  return sessions;
}

export async function clearCloudSessions() {
  const { error } = await supabase.from("focus_sessions").delete().not("id", "is", null);
  if (error) throw error;
}
