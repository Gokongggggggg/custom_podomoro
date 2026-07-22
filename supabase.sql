create table if not exists public.focus_sessions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null,
  task text not null default 'Untitled session',
  focus_ms bigint not null check (focus_ms >= 0),
  suggested_recovery_ms bigint not null check (suggested_recovery_ms >= 0),
  actual_recovery_ms bigint not null default 0 check (actual_recovery_ms >= 0),
  updated_at timestamptz not null default now()
);

alter table public.focus_sessions enable row level security;

drop policy if exists "Users manage their own focus sessions" on public.focus_sessions;
create policy "Users manage their own focus sessions"
on public.focus_sessions
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

revoke all on public.focus_sessions from anon;
grant select, insert, update, delete on public.focus_sessions to authenticated;
