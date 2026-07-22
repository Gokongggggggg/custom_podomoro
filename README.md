# Luwes

A personal, open-ended focus timer that adapts recovery time to the length of the actual focus session. It does not interrupt a productive flow just because a fixed Pomodoro interval has ended.

## Features

- Open-ended focus timer with pause and resume.
- Dynamic recovery recommendation based on actual focus time.
- Personal profile with today's activity and a seven-day focus trend.
- Complete session history with focus and actual break durations.
- What-if recovery calculator with a transparent formula breakdown.
- Automatic light and dark themes.
- Responsive layout for desktop and mobile.
- Optional browser notifications.
- Local-first storage with optional private Supabase sync across devices.

## Recovery formula

```text
recovery = clamp(round(focus × 20%), 3 minutes, 30 minutes)
```

Examples:

| Focus | Suggested recovery |
| ---: | ---: |
| 25 minutes | 5 minutes |
| 60 minutes | 12 minutes |
| 90 minutes | 18 minutes |
| 2 hours | 24 minutes |
| 3 hours | 30 minutes |

The 20% ratio is a deliberately simple product heuristic, not a universal biological rule. Research supports breaks for reducing fatigue and restoring energy, but does not establish one perfect ratio for everyone. The minimum and maximum prevent impractically short or disruptive recovery periods.

## Run locally

Requirements: Python 3 and Node.js for running the tests.

```powershell
npm start
```

Open [http://localhost:4173](http://localhost:4173).

Run the tests:

```powershell
npm test
```

## Personal data and storage

Luwes always stores its current state in the browser's `localStorage`. When signed in, completed sessions are also synced to Supabase for cross-device history and profile totals. Active timers intentionally remain device-local.

Without an account, it remains fully local:

- Works on static hosting such as GitHub Pages.
- Clearing site data also clears local-only history.

With an account:

- Completed sessions sync privately between signed-in devices.
- Row Level Security restricts every session to its owning user.
- The public frontend key is safe to commit; no privileged Supabase secret is included.

Run [`supabase.sql`](supabase.sql) once in the Supabase SQL Editor before using cloud sync.

## Deploy with GitHub Pages

After pushing the repository, open **Settings → Pages** on GitHub, choose **Deploy from a branch**, and select the repository's main branch and root directory.

## Project structure

```text
index.html          App structure
styles.css         Responsive light and dark themes
app.js             Timer, profile, history, and local persistence
cloud.js           Supabase authentication and session sync
supabase.sql        Database table and Row Level Security policy
recovery.js        Recovery formula and time helpers
recovery.test.js   Formula tests
```

## Privacy

This project has no telemetry or third-party analytics. Supabase receives account and completed-session data only when the user signs in.
