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
- Local-only personal data with no account or analytics.

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

Luwes stores its state, daily statistics, and session history in the browser's `localStorage`.

This is intentional for personal use:

- No backend or database setup.
- No account, password, API key, or hosting bill.
- Works on static hosting such as GitHub Pages.
- Data never leaves the current browser profile.

There are two important limitations:

- Clearing site data also clears the history.
- Data does not automatically sync between browsers or devices.

A database is unnecessary for the current single-user goal. IndexedDB or a small hosted database can be added later if the app needs larger history, backups, or cross-device sync.

## Deploy with GitHub Pages

After pushing the repository, open **Settings → Pages** on GitHub, choose **Deploy from a branch**, and select the repository's main branch and root directory.

## Project structure

```text
index.html          App structure
styles.css         Responsive light and dark themes
app.js             Timer, profile, history, and local persistence
recovery.js        Recovery formula and time helpers
recovery.test.js   Formula tests
```

## Privacy

This project has no telemetry, third-party analytics, or remote data storage.
