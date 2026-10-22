# Europe Trip 2026: handover for a new chat

Attach this at the start of a new conversation so Claude can pick up without re-learning everything. Last updated 22 Oct 2026, ~4 PM Athens time.

## What this is
A phone-only "app-like" website for Alex's 8-person Europe trip (19 Oct – 20 Nov 2026). Its core job is to open on the day and show where we are, what's booked, and what we could do. It looks and behaves like Apple Calendar's day view, with flat Calendar-style blocks and no emoji.

- **Live:** https://europe-family-trip.app (also europa-family-trip-2026.alexgibbs.workers.dev)
- **Repo:** github.com/alexandergibbs-cwf/europa-family-trip-2026. `git push` to `main` auto-deploys (Cloudflare Workers Builds, static assets from `public/`).
- **Files:**
  - `public/index.html` holds everything: CSS, JS and all data.
  - The other files that matter:
    - `public/apple-touch-icon.png` and `public/favicon.png`: Alex's hand-drawn "TRIP" on orange. The 180px icon is also inlined as a data URI in the page head.
    - `public/manifest.webmanifest`: name "Europe Trip".
    - `public/_headers`: noindex, no-cache.
    - `wrangler.jsonc`.
- **Source of truth for bookings:** `Europe-2026-Itinerary.pdf` (Tj's itinerary). `STAYS`, `MOVES` and `HEADS` match it as of 22 Oct.
- **Every stay is booked.** Never add "message the hotel" or "register" reminders. The only unbooked thing is the LNER Edinburgh→London train.

## Working method
- Edit `public/index.html` with small Python patch scripts (exact-string replace with assert). Never rewrite the file.
- Verify with Playwright (chromium only; WebKit can't install in the sandbox) at 390×844.
  - Fix the clock with an init script that overrides `Date`, and abort Open-Meteo requests.
  - Touch gestures go through CDP `Input.dispatchTouchEvent`.
  - Prompt and scene data is checked by reading `data-alts` off `.ev.prompt` elements. Everything sits inside an IIFE, so functions aren't reachable from outside.
- Commit and push after checking. Messages end with the co-author/session trailer.
- Alex tests on an iPhone (iOS 26 Safari, also added to the home screen) and sends screenshots or recordings. Extract frames with `ffmpeg -vf fps=2`.
- **Alex's style:** short, direct, design-led. He references Apple apps (Calendar, Clock, Messages).
  - If something looks bad, revert and try another approach.
  - Read his wording carefully. "Hour and half-hour slots" meant durations rounded to 30 min, not short blocks. "Coffee culture" meant Coffee + Culture.
  - Think like a travel organiser, not an algorithm.

## Data in index.html
- `STAYS`: 12 stays (city, in/out, hotel, ci/co, store, note, addr, lat/lng via `HOTELC`).
- `MOVES`: flights and trains.
  - `leave` is hotel departure time.
  - `ride` is door-to-terminal minutes.
  - `xfer` is landing-to-hotel-door minutes. These were checked 22 Oct, e.g. Athens→ATH 50, Paris 15e→CDG 60, Kensington→LHR 50.
  - `guess` holds times for the unbooked UK legs.
- `EVENTS`: fixed bookings that aren't travel. Currently `Sunset dinner`, Sat 24 Oct 5–7 PM, Santorini (end time is a guess). They carve free time, and `kind: "dinner"` suppresses dinner suggestions that day.
- `HEADS`: dated reminders. Hotel-contact and registration items were removed.
- `SAVES`: 361 places exported from Alex's mio app (name, cat, city, lat/lng, hook, rating, url, creator). mio live has 362.
  - No saves at all for Santorini or Glasgow.
  - No bars in Rome, Paris, Venice or Athens.
  - No restaurants in Florence.
  - mio's community DB is near-empty for these cities, so it can't fill the gaps.
- `CATS`: place categories: dinner (Eat), drinks, coffee, culture, see, shop, trip.
  - `isCulture` matches museum, gallery, palace, library, collection, etc. by name.
  - Libraries are excluded from shop.
- `WX`/`TYPICAL`: saved weather. Live weather comes from Open-Meteo (cached 3h).

## Day building (`buildDay`, `events`)
- Day range is 6 AM to 1 AM (earlier or later if a booking needs it).
  - The grid renders 12 AM to 4 AM next day.
  - Hours outside the range are hidden by negative margins and only peek in while pulling past the ends (`.pager { overflow: clip }`).
- **Departure:**
  - "Check out, to the airport/station" is one grey block covering the real ride (`leave` + `ride`).
  - Then "At the airport / At the station" (`k: "change"`, `term: true`).
  - If checkout is 90+ min before leaving, the day gets "Check out, leave bags" at checkout and "Collect bags, to …" later. If there's no storage, just "Check out".
- **Arrival:**
  - "To the hotel, check in" is the actual journey.
  - If it arrives more than 20 min before check-in, it becomes "To the hotel, drop bags" (ends at arrival + 15), then free time. Exception: Florence has no storage.
  - There are no separate purple check-in/out lines and no suitcase-wait blocks any more.
- **Packing:**
  - On departure days, "Pack suitcases" (mustard) sits 45 min before the departure block.
  - If the next morning leaves before 10 AM, it goes on the night before at 10:30 PM.
- **Title:** on travel days the header reads "Paris → Glasgow". The 19th reads "London → Perth".

## Suggestions (prompts)
They sit in free time and play as whole-day ideas ("scenes").
- **How a scene plays:** blocks fade in one at a time, hold, fade out together, then the next scene builds (`promptTick`, class `idea`).
- **Scenes (`SCENES`):**
  1. Coffee → Sightsee AM → Food → Dinner → Drinks
  2. Coffee → Culture AM → Food → Shop PM → Dinner
  3. Coffee → Shop AM → Food → Sightsee PM → Dinner → Drinks
  4. Coffee → Food → Culture PM → Dinner → Drinks
  5. Coffee → Culture AM → Food → Sightsee PM → Dinner
  6. Day trip → Dinner
- **Timing (`sceneFor`):** researched lengths rounded to whole or half hours.
  - Durations: coffee 1h, culture 2.5h, sightsee 3h, shop 2h, lunch 1.5h, dinner 2h, drinks 1.5h.
  - The morning block starts 10:30 and ends at lunch.
  - Meal times by country (`MEALS`):

    | Country | Lunch | Dinner |
    |---|---|---|
    | GR | 2 PM | 9 PM |
    | IT | 1 PM | 8 PM |
    | FR | 12:30 | 8 PM |
    | CH | 12 PM | 7 PM |
    | DE / UK | 12:30 | 7 PM |

  - In IT and GR, drinks come before dinner (aperitivo). Elsewhere they come after.
- **Places (`scenePlans` → `planGroup`):** an organiser's logic using only Alex's saves.
  - Each area block is a small cluster: up to 3 stops for sightsee/shop, 1 for culture.
  - Coffee is on the way from the hotel. Lunch is near the last stop. Dinner is between there and the hotel. Drinks are near the previous stop.
  - Proximity is preferred but not strict.
  - Variants rotate by variant and night index so days in the same city differ.
  - Text format is `names · walk time` + `\x1f` + mio hook (one-line description).
  - Fallbacks: "A café near X", "Somewhere near X", "A bar near X".
- **Travel days:** steps before departure use the city you're leaving, and steps after use the city you arrive in.
- **Day trips:** one destination per day from far saves within ~1h45 drive. Three blocks: "Travel to X" (estimated drive, rounded to 30 min, with road km) → "X" → "Travel back" (home by 6 PM).
- **Tapping a suggestion:** opens the planner with the shown place(s) pinned at the top ("Suggested").
- **Colours (tinted fill + inset accent bar, Calendar-style):**

  | Item | Colour |
  |---|---|
  | Travel | Blue |
  | Transfers, at-terminal, trip legs | Grey |
  | Pack | Mustard |
  | Coffee | Brown |
  | Food | Orange |
  | Sightsee | Green |
  | Shop | Teal |
  | Culture | Purple |
  | Dinner and booked dinner | Pink-red |
  | Drinks | Indigo |
  | Day trip | Mint |

  Suggestions are paler than booked items.

## Navigation and motion
- **Date wheel:** custom physics.
  - Drag is 1:1. Release glides on a timed ease (no spring overshoot): `wTw` tween, 760 + 380·√dist ms, cubic.
  - Wheel and content drags share the same physics. `wDrive` makes the timetable ride along.
- **Day view:** neighbouring days render as real pages beside it (`.dghost`, cached `dayHTML`). On landing, the day scrolls smoothly to its default time.
- **Pull past the top or bottom:**
  - The page stretches elastically (own touch handling with `preventDefault`, so Safari's pull-to-refresh never fires) and springs back with slight overshoot.
  - Pull past `PULL_GO` (120px, heavy haptic) and release to fade into the previous or next day (`pullFlip`). It lands at the default 7 AM view.
- **Two-day view:** replaced the 3-day view.
  - Calendar-style, with a fixed time gutter and sticky "Fri – 23 Oct" headers.
  - Columns pan with the finger and fling/snap via the wheel physics.
  - The wheel shows a two-day capsule (`.wsel.span2`).
  - Only bookings and plans show, not suggestions.
- **Sidebar (Cities), landing sheet, sheets:** unchanged from earlier builds.
  - The landing sheet no longer shows sunset.
  - The dimming scrim is `hidden` (out of layout) when closed. A full-height fixed layer made Safari 26 paint a solid grey bottom bar.

## Known gaps / open items
- **Safari bottom bar:** Alex wants page content to run under Safari's floating toolbar. The scrim fix is pushed but wasn't confirmed on device. If the grey band persists, look for any other fixed element touching the bottom edge.
- **UK rental addresses:** none supplied for Glasgow, Edinburgh or London ("Address in the booking").
- **LNER Edinburgh→London:** not booked. Times are guesses.
- **Sunset dinner:** restaurant name and end time unknown.
- **Day-trip drives:** estimated from distance, not routed.
- **Testing limits:** Playwright can't run WebKit, so Safari-only issues only show on Alex's phone.
- **iPhone performance:** avoid `will-change` and `backdrop-filter` on large scrolling ancestors.

## Alex's standing preferences
- **Look and feel:** no emoji, AM/PM times, sleek and clean, Apple-style UX, no redundant labels or disclaimers, no bottom tab bar, sidebar for cities.
- **Free time:** blank, with suggestions drifting in as day ideas.
- **Durations:** rounded to whole or half hours.
- **Motion:** smooth, light and airy, not bouncy (except the pull stretch, which should feel springy). Revert quickly if a change looks worse.
- **Home-screen app:** updates live. Only the icon and name need a re-add.
