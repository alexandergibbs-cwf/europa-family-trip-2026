# Europe Trip 2026: handover for a new chat

Attach this at the start of a new conversation so Claude can pick up without re-learning everything. Last updated 4 Nov 2026 (tab bar).

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
- **Calendar feed (Alex only):** `python3 tools/make_ics.py` rebuilds `public/cal/<token>.ics` from the app's own day logic (`window.__tripICS`). Run it after any change to STAYS / MOVES / EVENTS, then commit. Nothing in the app links to it; Alex subscribes via webcal://europe-family-trip.app/cal/<token>.ics. Times are floating (local), so the phone shows them as the app does.
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
- `SAVES`: 989 places exported from Alex's mio app (name, cat, city, lat/lng, hook, rating, url, creator). Last synced 3 Nov: +33 Zürich (@calmaguide.zurich, @francesco_cristiano) and +3 Paris vintage (@teatinz). Summer-only open-air spots (Rundfunk.fm, Rimini Bar, Barfuessbar) and hotel-type saves are in `KIND_FIX.skip`. mio's "VLS Property Partners" (a mis-resolved Liverpool listing) was left out.
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
- **Hand-made plans (`EVENTS` with `idea: true`):** grouped by `g` ("a" default, then "b", "c"…). Any number of groups per day take turns as scenes before the generated ones (`sceneFor` maps si −1→a, −2→b, …). Wed 4 Nov has five Swiss day trips as groups c–g (Schilthorn, Rigi, Titlis, Pilatus + Lucerne, Jungfraujoch); travel legs use `k: "tripgo"`/`"tripback"`, stops `k: "trip"`.
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
- **Tab bar (4 Nov, Alex picked option B over an Apple-Maps-style map+sheet):** floating glass capsule `#tabs.tabs` (Explore / Map / Schedule, `data-tab` xp|map|cal) above everything except sheets (z 35; 65 when the map is open, under the map scrim). `curTab()` reads state from `mapv.hidden` / `xp.hidden`; `setTab()` sets `aria-selected` and is called from `showXP`, `openMap`, `closeMap` and on load. Switching tabs keeps the chosen day and category (`showXP(true, true)` skips the jump-to-today). Tapping the active tab scrolls Explore to top / the day to its default time.
- **Removed switchers:** Explore's Cities button and Map+Schedule capsule, the map's List+Schedule capsule (`#mdone`/`#mcal` gone), the timetable's compass `#xpPill` and cities `#backPill` (both left in the DOM `hidden`), the left-edge swipe that opened the sidebar. The `.side` sidebar code is still there but nothing opens it.
- **City title → one sheet:** Explore's large title (`.xp-tt[data-trip]`), the map's top pill (`.mtt`, text from `mttSet()`) and the timetable `#titlePill` all open `daySheet()` = `menuSheet()` (rows now: hotel, Plan the day, Near me now, things to sort; Alex removed Map, Things to do, Add to my calendar, How it works and Suitcases on 4 Nov, and the tour's "Lock-screen alerts" page went with Add to my calendar; don't re-add) plus a grouped Cities list (`.tripc .crow[data-tripgo]`). Picking a city jumps to its first day (today if current) on whichever tab you're on. (There's an older unused `tripSheet()`; don't confuse them.)
- **Map suggestions panel (4 Nov, from Alex's Corner app recording):** `#msug.msug` inside the map, peeking above the tab bar with a grabber and "Nearby" / "<Category> nearby" (`#msugt`). Tap the handle for half height, drag for full; flicks step one stop. States are classes `half` / `full` via `sugTo()`; `mapv.sugup` hides the locate button while it's up. The list is hidden in the peek state. Rows are `xpRow` (64px thumb), nearest 40 saves for `MCAT`, built by `sugRender()` at the end of `drawMap()` (signature `SUGSIG` avoids rebuilds; distances refresh in place). Tapping a row collapses the panel and picks the pin like a card tap (`mapPick` → `mapAim` → `mapPlace`). The panel slides away while a pin is picked or carded. Locate button now sits at 158px (180px when picked).
- Bottom offsets moved up for the bar: `.xp` padding-bottom 110px, map `.mcar`/`.mcard` 84px.
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
- **Look and feel:** no emoji, AM/PM times, sleek and clean, Apple-style UX, no redundant labels or disclaimers. **4 Nov: Alex reversed the old "no bottom tab bar / sidebar for cities" rule** and chose an iOS 26 floating tab bar (see Navigation below).
- **Free time:** blank, with suggestions drifting in as day ideas.
- **Durations:** rounded to whole or half hours.
- **Motion:** smooth, light and airy, not bouncy (except the pull stretch, which should feel springy). Revert quickly if a change looks worse.
- **Map motion (4 Nov):** Alex found it too aggressive. Camera `ease` is now cubic-bezier(.3,0,.15,1) (was a quartic that covered half the move in 100ms); `mapAim` 950ms; locate uses one `mapFlyHere` flyTo (curve 1.15, speed .9) instead of two that restarted each other. Pins, card row, chips and buttons use `--glide` (cubic-bezier(.22,.8,.24,1)), no overshoot; picked pin scale 1.26. Pin re-layout mid-move throttled to ~4.5/s.
- **Home-screen app:** updates live. Only the icon and name need a re-add.

## Shared state (added 25 Oct)
- `src/worker.js` runs before assets for `/api/*` and `/cal/*` (see `wrangler.jsonc`). KV namespace `europa-trip-shared` (binding `SHARED`) holds one value `state` = `{ key: { v, ts } }`, newest change wins.
- Shared keys: `plan:<iso>` (added stops), `dayplan:<iso>` (Plan the day), `pick:<iso>:<k>`, `cal:<iso>` (calendar lines worked out in the app), `uk-eta`. The app writes through `put()`, pulls on open, every minute and when it comes back to the front.
- The calendar feed is served by the worker: the static `public/cal/<token>.ics` plus the `cal:*` entries. Still rerun `python3 tools/make_ics.py` after changing STAYS, MOVES or EVENTS.

## Explore-first (added 4 Nov)
- The app now opens on **Explore** (`#xp`, `xpRender`): city, "Near you" or "Around <hotel>", day chips, category chips, then sections in time-of-day order (`xpOrder`) of saves within 3 km, nearest first. The Schedule button switches to the timetable; the compass pill in the timetable switches back. Days with a flight/train departure open on the schedule. Alex said the timetable is mostly used for flights; treat the app as a "what to do and where" guide first.
- **Explore header (4 Nov, Alex: top felt messy, not Apple-faithful):** iOS large-title layout. Bar: Cities button left; Map + Schedule are one grouped glass capsule (`.xp-grp`, icons only, no "Schedule" label), same capsule on the map (`#mdone` + `#mcal`). Large title = city, subline = location arrow + "Near you" / "Around <hotel>" (full date if neither). Day pills replaced by a Calendar-style week strip (`.xp-wk`: narrow weekday over date number; today red, selected filled circle, red if today). One chip row only: categories, filled grey (tertiary fill) rather than outlined. On scroll the large title slides under the bar and a centred inline title (`.xp-nt`) fades in (`xp` gets class `sc`, set by a passive scroll listener; re-checked after each `xpRender`).
- **Place cards:** every row has a 64px thumbnail on the left (`ph()`): a tinted icon tile with the photo layered on top, so there's always a picture.
- **Emoji:** map pins keep emoji (`emoOf`). Category chips everywhere, map included, use the drawn icons (`svgI`/`ICON`); `MCHIP` is no longer used. List thumbnails without a photo use drawn icons too.
- **Map chrome matches Explore (4 Nov, Alex: the map felt like a separate app):** the map's top bar is Explore's `.xp-top` with `.pill.glass` buttons. The list icon (`#mdone`) sits where Explore's map icon is, so the two toggle; it closes the map and calls `showXP(true)`. `#mcal` (Schedule) closes the map and calls `showXP(false)`. No city title or blue Done any more. Category chips are Explore's pills at the top (`#mchips.xp-row.xcats`) and stay visible when a pin is picked; the emoji dock and bottom gradient are gone. `MCAT` and `XCAT` are shared both ways. The locate button is a `.pill.glass.ib`. Card row (`.mc`) uses Explore row sizing (64px thumb). Pin hooks are no longer italic. `#mapc { z-index: 0 }` keeps pins under the controls.
- **Map:** OpenFreeMap vector tiles (positron, dark at night; free, no key) drawn by native MapLibre GL 4.7.1 (Leaflet removed 4 Nov for smoothness), recoloured in `tintMap`. Pins are MapLibre HTML markers (`mkMarker`) that morph between states; layout reruns during moves (~7/s) and on moveend. CARTO now needs a key, don't go back to it. No attribution ⓘ button on the map (removed 4 Nov at Alex's request)., mio-style decluttered pins (`layoutPins`): up to 14 labelled bubbles, 12 bare bubbles, the rest dots. Closed places fade.
- **Near here, next** (`nextNear`): bottom of each place sheet, complementary kinds within 1.2 km (`NEXT`).
- **Opening hours:** removed at Alex's request (Google cost). Don't add paid lookups without asking.
- **Map picking (mio style):** tapping a pin calls `mapPick`: the pin grows with a stem, the map slides it to the upper third (`mapAim`), the category row gives way to a swipeable card row (`#mcar`, the pick plus the 24 nearest), No name pill at the top (removed 4 Nov, Alex: the card already shows the name); `#mselx` stays in the DOM hidden. Tap empty map to clear. Swiping cards moves the pick and the map. Tapping a card opens the place sheet at ~56vh so the map stays visible. Tapping empty map clears it. **Pin taps (4 Nov):** name labels (`.mp .t`, and `.mp` itself) take no touches; only the bubble/dot (`.mp .b`, plus the 40px `.pinw`) does, and hidden pins' wrappers are `pointer-events: none`. A tap that misses every pin falls through to `MAP.on("click")`, which checks `labelAt()` (topmost label under the finger, incl. the hotel) and calls `pinTap()`. Reason: the picked pin's label sat above nearby dots and kept re-opening the same place. Place sheets show photos as a mio-style strip (`.gal.strip`).

- **Place sheets:** no "Saved from" credit (Alex: not needed). The search button is Google (`gq`), not TikTok. No prices: mio doesn't expose price level and Alex won't pay for Google lookups.
- **Place sheet layout (4 Nov, mio-style):** photo strip → name → `placeMeta` (kind · rating, plus "On the day, <time>" in blue when added) → hook as a plain TLDR line (`.pl-tl`) → one action row (`.pacts`): Directions pill (flex, distance underneath via `placeDist`/`.pdist`, refreshed by `refreshSheetDist`), then 50px icon circles for Add (bookmark, `data-zadd`), Video, Share (`data-pshare`: native share sheet with name, address and a Google Maps link; copies if no share), Google. Alex: no address text (Directions covers it), no "More photos", no second button row. Icons in `PI`/`pI`.
