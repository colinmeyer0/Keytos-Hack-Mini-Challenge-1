# Exit Verification Challenge — Design

## Intent
Hackathon mini-challenge: "worst cancel screen ever", judged on most confusing, most hostile, most creative. Rule: cancelling must still be possible for a determined user. Fake service only, PG, runs on localhost.

The concept: an aim-trainer-style challenge where, to cancel *StreamVault+*, you must close a flood of fake OS popup windows before a timer runs out.

## Decisions
- **Fake in-page windows, not real OS popups.** Real `window.open` popups are blocked in bulk, their X button can't be faked or moved, and Wayland ignores window positioning. Windows are `<div>`s styled as an original 90s-style OS (not a copy of Windows/macOS).
- **Fullscreen takeover.** Clicking "Begin" calls `requestFullscreen()` on the fake desktop. Leaving fullscreen (Esc) mid-run voids the attempt. If fullscreen fails, the game runs anyway.
- **Three twists only** (chosen by the team):
  - **Hydra windows:** two close buttons; the fake one spawns 3 more windows and the hydra stays.
  - **Trap windows (do NOT close):** double-negative copy; closing one costs 5 seconds. They never need closing — the run is won when only traps remain.
  - **Dodger windows:** slide away when the cursor approaches the close button; give up after 3 dodges.
- **Winnable by design:** the fake hydra button uses a slightly different glyph than the real one, dodgers tire out, and the number of open windows is capped.
- **Windows are draggable** by their title bar and come to the front on click (traps and spawned windows can bury others).
- Plain HTML/CSS/ES modules, no build step, served with `python3 -m http.server`. Pure logic is unit tested with `node --test`.

## Flow
1. Account page for StreamVault+ with a cancel button.
2. Intro dialog: "Exit Verification Challenge™ — close all windows in 30 seconds." Begin → fullscreen desktop.
3. Run: windows spawn in a burst and then steadily; taskbar shows time remaining and windows remaining.
4. Lose → guilt-laden fail dialog: "Try again" or a big "Keep my subscription".
5. Win → "Your subscription has been cancelled."

## Non-goals
Rigged timer, leaderboards, upsells, cursor slowdown, real accounts or payments, deployment.
