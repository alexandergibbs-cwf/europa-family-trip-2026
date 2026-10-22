# Europe Trip 2026 — handover for a new chat

Paste this at the start of a new conversation (or attach it) so Claude can pick up without re-learning everything.

## What this is
A phone-only "app-like" website for Alex's 8-person Europe trip (19 Oct – 20 Nov 2026). Core job: open it on the day and see "this is where we are, this is what's booked, this is what we could do". Looks and behaves like Apple Calendar's day view, Notion-Calendar-flat blocks, no emoji.

- **Live:** https://europe-family-trip.app (also europa-family-trip-2026.alexgibbs.workers.dev)
- **Repo:** github.com/alexandergibbs-cwf/europa-family-trip-2026 — `git push` to `main` auto-deploys (Cloudflare Workers Builds, static assets from `public/`).
- **The whole site is one file:** `public/index.html` (CSS + JS + all data embedded). `wrangler.jsonc`, `public/_headers` (noindex, no-cache) are the only other files that matter.
- Source of truth for bookings: `Europe-2026-Itinerary.pdf` (Tj's itinerary). The data in `index.html` (`STAYS`, `MOVES`, `HEADS`) was checked against it on 22 Oct and matches.

## Working method that's been used
- Edit `public/index.html` with small Python patch scripts (exact-string replace with assert), never rewrite the file.
- Verify with Playwright (chromium only; WebKit can't be installed in the sandbox) at 390×844, `isMobile`, `hasTouch`, clock fixed to a trip date, Open-Meteo requests aborted. Screenshot, review, then commit + push. Alex tests on his iPhone (iOS 26 Safari) and sends screenshots/screen recordings — frames can be extracted with `ffmpeg -vf fps=2`.
- Commit messages end with the Claude co-author/session trailer.
- Alex's style: short, direct, design-led. He references Apple apps (Calendar, Clock timer picker, Messages, Claude app sidebar). If something "looks bad", revert and try a different approach rather than tuning the bad one.

## Current structure of index.html
**Data:** `STAYS` (12 stays: city, in/out, hotel, ci/co, store, note, addr), `MOVES` (10 flights, 4 trains, 2 UK legs with guessed times), `HEADS` (dated reminders/tasks, some tickable via `k`), `WX`/`TYPICAL` (saved forecast fallback), `GEO` (city coords), `SAVES` (361 places exported from Alex's mio app: name, cat, city, lat/lng, hook, rating, url, creator), `HOTELC` (hotel coords).

**Layout:** `.page` wrapper → fixed `.top` (header pills + date wheel) + `.pager` → `#daycontent`. Document (window) scrolling — deliberately, so content runs under Safari's bottom bar. `#daycontent` has `padding-top: var(--top-h)`; `measureTop()` keeps it in sync.

**Header:** left = sidebar icon (`#backPill`, opens Cities); centre = city title with › (`#titlePill`, opens the day "landing" sheet); right = day/3-day toggle (`#modePill`, icon crossfades, blue when 3-day).

**Date wheel:** custom physics (not scroll-snap): `wPos/wVel`, drag 1:1, fling with friction, spring-snap to nearest, light haptic per date, rubber-band at ends, tap to jump. Fixed grey slot in the centre (`.wsel`, red-tinted when today); numbers uniform weight; edges dissolve via mask. Functions: `wRender`, `wStep`, `centreDay(iso, smooth)`, `wSettle` → `selectDay`.

**Day view (`renderDayContent`):** grid from 5am (`LO = min(300, first event)`) to midnight, 1px/min. Opens at 7am (`scrollToDay`), or later on today if the now-line would be off-screen. Blocks: travel (blue), get/transfer (grey), wait/suitcases (peach), prompts Coffee/Lunch/Sightsee/Dinner (faint grey, on whole hours inside free time), plan (added stops). Check-in/out are thin purple lines with a small label. Arrival logic merges "To the hotel" with either "check in" (if check-in is within ~75 min) or "drop off suitcases" (if later). Pull past the top/bottom of a day flips to the previous/next day.

**3-day view (`renderMultiContent`):** three columns from the selected day, sticky column headers (`.mh`, `top: var(--top-h)`), compact blocks, marks and now-line; swipe moves 3 days; tap header → that day; tap block → its sheet.

**Sidebar (Cities):** full-bleed panel behind; the page slides right as a rounded card (`.page.shifted`, position fixed while open, scroll position preserved via `--sy`). Finished stays are hidden. Blue ring springs to a tapped city, then the panel closes and the day changes. "Now" city row jumps to today.

**Sheets:** `openSheet(html)` bottom sheet with drag-to-dismiss (direction-mode detection so lists still scroll), extends 120px below viewport so Safari's bar blurs the same colour. Day landing sheet (`menuSheet`): big city, "22–25 Oct · night 1 of 3", date + "Jump to today", weather beside the name (tap → `wxSheet`), rows: hotel (→ `staySheet` with Directions / Show to driver), Things to do (cycling time-weighted suggestions from mio saves with drawn icons → planner with Eat/Wine/Coffee/Sightsee/Shopping/Day-trip tabs, distances from that night's hotel), things to sort (→ `tasksSheet`). No close button (swipe/tap outside).

**Other:** live weather from Open-Meteo per city (cached 3h), fallback table; haptics via `navigator.vibrate` / iOS switch trick; `prefers-color-scheme` dark; Liquid-Glass experiment was removed (Alex didn't like it) — pills are plain blurred glass.

## Known gaps / open items
- Exact addresses for Glasgow / Edinburgh / London rentals not supplied (shown as "Address in the booking").
- LNER Edinburgh→London not booked; times are guesses (`guess`).
- Performance on iPhone: avoid `will-change`/`backdrop-filter` on large scrolling ancestors — a `will-change: transform` on the page wrapper made scrolling laggy once.
- Playwright can't run WebKit here, so Safari-only layering/sticky issues only show up on Alex's phone.
- Netlify site is obsolete; Claude artifact copy is stale.

## Alex's standing preferences (from this build)
No emoji; AM/PM times; "sleek and clean"; Apple-style UX; no redundant labels or disclaimers; no bottom tab bar; free time blank; suggestions on whole hours; sidebar for cities; animations should have proper ease-in/out and feel snappy; revert quickly if a change looks worse.
