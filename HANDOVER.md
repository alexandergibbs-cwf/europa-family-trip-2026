# Europe Trip 2026: handover for a new chat

Attach this at the start of a new conversation so Claude can pick up without re-learning everything. Last updated 5 Nov 2026 (map rebuild; place = details pill + Nearby pill; Nearby/trail shown on the map; video in the place card; Nearby "all"). Tour: 3 pages (map, swipe days, ideas); the Plan the day and calendar pages were removed. Sheet titles use `text-wrap: pretty`, not balance.

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
- `SAVES`: ~1,346 places exported from Alex's mio app (name, cat, city, lat/lng, hook, rating, url, creator). Last synced 3 Nov: +33 Zürich (@calmaguide.zurich, @francesco_cristiano) and +3 Paris vintage (@teatinz). Summer-only open-air spots (Rundfunk.fm, Rimini Bar, Barfuessbar) and hotel-type saves are in `KIND_FIX.skip`. mio's "VLS Property Partners" (a mis-resolved Liverpool listing) was left out. 5 Nov syncs: +40, +51, +12 (mostly Berlin bars, cafés and Irish pubs, a few Glasgow/Paris); mis-resolved OBO (Sauerland factory) and King & I (Hellersdorf youth centre) left out. "Lorena's" was mio's wrong match for Joseph-Roth-Diele Gaststätte (Potsdamer Str. 75): renamed and moved in SAVES. The new ACID on Rosenthaler Str. is "ACID Mitte – Rosenthaler Str." because same name + city counts as a duplicate (`seen` key) and would hide the other ACID Mitte.
  - Berlin field guide (gibbs-berlin.vercel.app): only its main planned stops are saves (`id` "guide-…": Sachsenhausen Memorial, Führerbunker site, Picknweight, Antikmarkt Karlshorst, Berlin Story Bunker; the rest are Alex's own mio saves). **5 Nov, Alex: remove everything optional from that site.** The guide's optional and "more" places (Made in Berlin, Museum Karlshorst, Soviet War Memorial, Bendlerblock, Anhalter ruin, Air Ministry, Unterwelten, Fichtebunker, Wannsee, Tempelhof tour, Aroma, Good Friends, Militaria Berlin, Konnopke's, Hackesche Höfe, Clärchens, Curry 36, Mustafa's, Rausch, Bebelplatz) were removed, along with the Militaria WhatsApp reminder. Don't re-add them.
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
- **Berlin 5–7 Nov:** the `EVENTS` ideas are the field guide's main (bold) schedule only, with its transit legs and "Dinner and pack"; all optional stops and optional mentions in notes were removed on 5 Nov at Alex's request. Titles match save names so `ideaSave` links them. Ideas stay off the calendar feed.
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
- **City title → cities only (5 Nov, Alex: the rest was pointless):** Explore's large title (`.xp-tt[data-trip]`), the map's top pill (`.mtt`) and the timetable `#titlePill` all open `daySheet()`, which is now just "Cities" plus the grouped list (`.tripc .crow[data-tripgo]`). Near me now, Plan the day, things to sort, the hotel row and the weather are gone from it (`menuSheet()` is unused). Picking a city jumps to its first day (today if current) on whichever tab you're on.
- **Opens on the map (5 Nov, Alex), always, travel days included:** at startup `openMap(null, true)` (quiet, no haptic). `?schedule` / `?explore` override this for testing. First-run cards (location, tour, Add to Home Screen) are lifted above the map (z 90/91). Tour page 1 says the app opens on the map.
- **Which city the map and Explore show (`mapStay`):** tonight's stay. On a travel day that's the city you're heading to (Alex: "forget Zürich, open on Berlin"). If you're far from it, the map centres on that hotel. `mapHere()` only uses your location within 40 km of that stay. `liveFrom` is back to "near tonight's stay" only (the travel-day extension made the place sheet in Berlin say "day trip" while Alex was in Zürich). Switching city on the map fits the view like "all".
- **Colour key:** pins take their rail button's colour via `pinCol()`: sights use culture purple, clothes use shops teal, and experiences are green (#34c759). Each rail label has a matching dot (`.mdock small .lg`).
- **Home button:** the rail's 🏠 "home" (when there's a hotel) only eases the map to the hotel. Tapping the hotel pin opens its details in the map panel. **5 Nov, Alex: the hotel should look like every other place, with check in/out and Nearby.** In the map panel the hotel is two pills like a place: details (`staySheet(s, split)`: name, "Night 1 of 3 · address", Directions pill, a two-cell check in / check out row `.stio`, the stay note `.stnt`; the row and note fold away in `.pcl` when Nearby opens) and the Nearby pill, anchored on `stayZ(s)` (a pseudo place `{ id: "stay:<in>", stay: true }`). With Nearby open the hotel pin stays visible as the anchor (no fake pin added) and the dotted lines run from it; going back to the hotel clears the picked pin. The old check-in/address/luggage table and the "All 12 stops and booking refs" button are gone; don't bring them back. No hotel photo (it would be a new Google lookup). "Show to driver" was removed earlier.
- **Map = two layers only (5 Nov, Alex liked the swipe cards and disliked the category list sheet and the cluttered place sheet):**
  - Fixed: city pill top-left (opens day + cities sheet), locate top-right, category rail `#mdock` and tab bar at the bottom. Nothing slides away.
  - **Browse = rail + swipe cards.** Rail (`DOCK`, `dockRender`): search, eat, cafes, sweets, bars, sights, culture, shops, clothes, experiences (emoji icons, lowercase labels, only kinds with saves). Tapping one filters the pins (`mapFilter`) and fills the card row via `carShow(railList())`, nearest 25 first, and picks the first card's pin. Tapping the same category again clears it (all pins, no cards, list closed). Categories sync to Explore's `XCAT`. **Top picks was removed on 5 Nov at Alex's request.**
  - **"all" (5 Nov):** second in the rail after search (📍), selected whenever no category is on. Tapping it shows every pin and fills the cards with the nearest of everything ("all · See all 144", list title "144 saved places nearby"). Tapping a selected category again also goes back to all.
  - **Zoom tiers (5 Nov, after Alex's zoomed-out Berlin screenshot of overlapping dots and labels):** in `layoutPins`, by `MAP.getZoom()`:
    - Street, ≥ `Z_STREET` 14.5: up to 14 labelled pins with one-liners, 14 bare bubbles, the rest dots (as before).
    - Neighbourhood, 13–14.5: up to 6 labels, one-liners hidden (`.mapv.zmid`).
    - City, < `Z_CITY` 13: no names; up to 16 bare icons where they fit, every other place a small dot in its category colour (`.mapv.zfar .mp.s-d`, scale .22) so you can still see what's where. Count bubbles were tried and dropped on 5 Nov in favour of dots, at Alex's request. The hotel shows as 🏠 only.
    - Picking a place from the cards or list while zoomed out brings the map down to street level (`mapAim` zooms to at least 14.5).
    - `window.__tripMap()` returns the MapLibre map, for tests only.
  - The rail's "all" icon is 🗺️ (not 📍, which looked like a place pin).
  - **Opens on you (5 Nov):** every time the Map tab opens it jumps to your location at zoom 15 (`mapHere()`: a fix under 30 min old within 40 km of the day's hotel, on any day), else the day's hotel at zoom 14. It also takes a fresh fix on each open and eases to it, unless you've already dragged or zoomed (`MUSER`, set by `dragstart`/`zoomstart` with an original event) or picked a pin.
  - **Tools row, pinned category, list as a card (5 Nov, latest):**
    - Search `#mtq` and home `#mth` are 36px glass circles in `#mtool`, either side of the count pill `#mgrab`; they share `dockClick` with the row. `#mdock` holds categories only.
    - The picked category moves to the front of the row and is `position: sticky; left: 0`, so it can't scroll out of sight (Alex: you lose what's selected). The row fades 14px at each edge.
    - Opening the list (Alex's idea): the tools row and categories slide up under the city pill (bottom: calc(100% - safe - 98/154px)), the pill's chevron flips, and the list rises from below as a floating card (`.mlist:not(.pm)`, inset 10px, top safe + 160px). Tap the pill again to close.
    - **List height and controls (5 Nov, Alex: show about 3 places so the map stays visible; then: no gap, categories as they normally are):** the list card is `--lh` tall (min(400px, room left)), bottom-anchored, showing 3 rows and a peek of the 4th, scrolling inside. The tools row and categories no longer jump up under the city pill: they sit just above the card in the normal order and spacing (card → 8px → categories → tools, as above the card row). Opening the list eases the map so the picked pin sits in the open band at the top (`listOpen`). This supersedes the "slide up under the city pill" note above.
    - Category fits zoom out more: radius 5 km (all: 8 km), max zoom 14.2.
  - **Tabs on top, one way into the list, search on the keyboard (5 Nov, latest; supersedes the tab bar notes in Navigation and the `.mdn` count pill below):**
    - Alex: the tabs aren't used all the time, so they shouldn't eat the bottom. `#tabs` is now a 132×44 icon-only glass capsule fixed top-right on every screen (selected = blue fill, labels hidden). It sits at safe area + 8px, level with the city pills (at the bare safe-area line it caught iOS's status-bar blur). Map locate `.mme` sits under it (safe area + 62). Schedule's `#pills` is a flex row: city pill then the two-day switch on the left, padded clear of the tabs. All the bottom offsets lost the tab bar's ~70px (row 10px, cards 58px, grabber 66/190px, pins avoid 84/212px).
    - Alex: the 🗺️ "all" button and the "☰ 224" list pill did the same job. Both are gone. Nothing picked = everything; the picked category pill carries a ✕ (tap it to go back to everything). Bottom stack, bottom up (Alex: categories belong above the example places): cards `.mcar` (10px), the category row `#mdock` (122px when picked, 10px otherwise and while the list is open), then `#mgrab`, now a small glass pill naming what the list will show ("20 cafes ⌃", "224 saved places ⌃", from `listTitle` minus "nearby", set in `dockRender`). Tapping it or swiping up on it, the cards or the row opens the list. Alex asked "how do we actually see all": that pill is the answer, and the ✕ on a picked category goes back to everything.
    - Alex: search at the top with the keyboard at the bottom was "terrible design". `#mqbar` now sits at the bottom where the row was and rides on the keyboard via `--kb` (set from `visualViewport` resize/scroll; `KB()` adds it to the fit padding and pin avoid box while searching). Result cards sit just above the field; the row hides while searching; city pill, locate and tabs stay. Opening search closes the list. **Picking a search result (5 Nov, Alex: the field sat on top of the Nearby pill):** while a place is open the field and the "Nothing saved" note slide down out of sight (`.mapv.qon.pmode .mqbar`) and the keyboard drops (`panelPlace` blurs `mqi`); closing the place brings the field and results back, like Apple Maps.
  - **Resting card row (5 Nov, Alex: with nothing selected there should still be a horizontal row of places near you; swipe it down to hide):** when no category, search, list or place is open, `carsSync()` (run from `layoutPins`) puts `.mapv.cars` on and fills `#mcar` with the 25 places nearest you (`mapHere()`, else the hotel). No pin is picked and the map doesn't move; swiping the cards still pans to each one, tapping one opens it. Every `.mapv.picked X` layout rule also applies to `.mapv.cars X` (except hiding the city label); pins avoid the row via `MCROW()`. A downward swipe on `#mcar` sets `MCHID` (hidden, also drops a pick) until the map is opened again (`openMap` resets it). Refills when the city or your position changes (`MCARS` key).
  - **One bottom row (5 Nov, late; Alex asked whether the tab bar should go to the top for room, and whether "all · See all" needed to say anything):** kept the tab bar at the bottom (thumb reach, iOS convention, Explore's large title owns the top) and won the space by merging the rail and the See all pill into one compact row `#mdock` just above the tab bar. `dockRender` builds it: a list button `.mdn` (list icon + count only, shown when cards are up; tap toggles the list), then search / home / all as 36px icon-only circles (`.mdi`), then categories as glass capsules (emoji + label, selected = ink fill). The picked group's sub-chips render inline straight after it, and the row scrolls the picked group into view. `#mhdr`/`#mhd`/`#mlsubs` stay in the DOM but are hidden; `mhdSet` now also calls `dockRender`. Cards sit at bottom 126px, pins avoid 272/140px. Colour key kept (Alex: zoomed-out dots make no sense without it): each category capsule (`.mdc`, `--c` from `MAPCOL`) has a dot before its label, and the picked one fills with its pin colour (white text, dot hidden). If Alex still wants the tab bar on top, that's the next thing to try.
  - **Rail must scroll (5 Nov fix):** `#mdock` sits just above the tab bar (`bottom: 80px + safe area`) with `touch-action: pan-x` and normal pointer events. It used to span to the bottom with `pointer-events: none` (buttons auto), and iPhone wouldn't scroll it sideways. When the list is open, its panel backing reaches down behind the tab bar via a box-shadow.
  - **Rail groups and sub-chips (5 Nov):** the rail is search, all, eat, cafes, sweets, bars, culture, shops, experiences. `GRP` maps each button to kinds: culture = culture + see, so "sights" is no longer its own button; shops = shop + clothes. `KGRP` maps Explore's `XCAT` onto them when the map opens. Picking a group shows sub-chips (`subsHTML`, state `MSUB`, tap = `subTap`) in a row with the See all pill above the strip (`#mhdr`), and again in the list header (`#mlsubs`). Sub-chips are worked out from name + one-liner + vibe with the regexes in `RX`, and only appear when something matches:
    - eat: breakfast (also pulls in cafes that match brunch/bakery), lunch, dinner. Restaurants with no clue count as both lunch and dinner.
    - bars: cocktails, wine, beer.
    - culture: museums (culture kind), sights (see kind), views, parks.
    - shops: clothes (clothes kind), vintage, design, books & records, markets & food.
    Tapping a sub again clears it. In the list, a sub refills the list and keeps it open. Titles use the sub's noun ("10 breakfast spots nearby").
  - **City switch on the map (5 Nov):** picking a city in the day + cities sheet while the map is open sets the day instantly (`xpDay`, not the animated `selectDay`), clears the pick, list and search, and redraws centred on that city. Before this the map redrew before the day had changed, so it took two taps.
  - **Directions icon (5 Nov):** a turn arrow (`PI.go`, `MCARROW`) on the place sheet and the cards, so it no longer looks like the locate arrow.
  - **Pull up for the list (5 Nov):** a grabber `.mgrab` sits above the strip whenever cards show. A vertical swipe up on the strip, the chip row (`#mhdr`) or the category rail opens the list (only when picked and the list is closed); horizontal swipes still scroll those rows.
  - **Category = lay of the land (5 Nov, third pass; Alex: tapping coffee etc. should zoom out a decent amount):** `carShow` fills the strip, picks the first card, sets `SEEN` and calls `overview(list)`. That fits the map to that kind's cards within ~3 km of you or the hotel (at least the nearest 5 if fewer than 3 are that close), plus your position, max zoom 15.5, leaving room for the strip. The same happens for sub-chips and search. While `SEEN` is on, swiping cards only pans (`mapAim`), and tapping a pin is what zooms in (`mapPick(z, true)` clears `SEEN`). The pill always reads "See all N" and one tap opens the vertical list (no separate zoom step; `seeAll` was removed).
  - **See all (5 Nov):** a glass pill `#mhd` above the card row ("cafes  See all 18 ˄", `mhdSet`, hidden under 3) or a swipe up on the cards (`listOpen`) opens `#mlist`: a panel from just under the city pill down to the rail, title "18 cafes nearby" (`listTitle`, `LISTN`), with every pin's place stacked as the same `.mc` cards (`mcHTML`, shared with the row), nearest first (`fullList`). Rail and tab bar stay, and the rail gets a panel backing (`.mapv.lon`). Switching category refills it (`listFill` from `drawMap`). Close by dragging the header or the list top down, tapping the header, or tapping the map strip. Tapping a row closes the list, picks the pin and opens the place sheet.
  - **Category check (5 Nov, Alex spotted Kitten Deli under shops):** saves were audited against their one-liners, and misfiled ones go in `KIND_FIX`: dinner + Kitten deli, goldies bar, Aki; drinks + Rhinoçéros, migas, Billie, Sebb's; sweet + Fruttini, Limon'è; coffee + OUTLIER, Spirito; shop + The Rich Collection Bella Italia (a shoe shop that `CULT` caught as culture); culture + Gucci Garden, TAPISSERIE & ARTES ARTISANALE. Also `CLO_NO` + "do you read me?!" (a bookshop). Mixed places stay put (concept stores with cafés, cafés that become bars at night).
  - **Shop sub-chips don't overlap:** clothes = every clothes shop; vintage = clothes or other shops that read vintage. Every other shop gets one sub from `shopSub()`, first match wins: beauty & scent (`RX.beauty`: fragrance, perfume, candles, skincare, apothecary…) → vintage → books & records → markets & food → design & home (`\bdesign(?!er)`, so "designer" clothes don't count). Views and parks only take sights. `RX.park` skips "car park" and "rope park", needs a whole word "park" (so "sparkles" doesn't count), and no longer counts lakes or rivers.
  - **Experiences (5 Nov):** the group `GRP.experience` has an `extra` test. Saves of other kinds whose text matches `RX.exp` join it: photo booths, swings, slides, toboggans, karaoke, cinemas (`\bcinemas?\b`, so "cinematic" doesn't count), boat hire, tours, saunas/spas, skating, zoo and so on. Restaurants, cafes and sweets only join for karaoke, photo booths, bowling or cinema. `inGrp` honours `extra`. Counts: Zürich 5, Berlin 12, Paris 2, Glasgow 6, Edinburgh 5, London 2.
  - **Search (keywords, 5 Nov):** the rail's search icon swaps the city pill for a glass field `#mqbar`/`#mqi` (placeholder "burger, brunch, vintage…") with Cancel `#mqx`. Typing (`MQ`, 180ms debounce) filters pins via `qHit()` and fits the map to the results like a category does. Every word must fit. A word fits if it starts a word in the name, one-liner, vibe or kind label (so "burger" doesn't match Brandenburger Tor), or if it's a keyword in `QKW` for a kind or sub idea (food/eat/restaurant → eat; coffee/cafe; drinks/bar/pub; cocktail/wine/beer; dessert/ice cream; museum/art/gallery; sights/view/park; shop/shopping/clothes/fashion/vintage/design/books/market; brunch/breakfast/lunch; experience). Plurals and accents are ignored. With no match, a glass note `#mqnone` says "Nothing saved in <city> for “…”". Search only covers the current city's saves.
  - **Detail = place sheet**, from tapping a card or a picked pin. On the map its photo strip is shorter (150px), the Directions line is one line with ellipsis ("26 min by metro", no "or taxi"), and the "NEAR HERE, NEXT" label is gone (the section heading like "Drinks nearby" is enough).
  - The category list sheet (`#msug`, top-rated carousel, `.mcd` cards) was removed on 5 Nov: it duplicated Explore and covered the map. Don't bring it back.
  - `mcarFill(list)` renders the card row (pulled out of `mapPick`). Pins avoid the bottom 176px (290px when cards show) so labels don't sit under the rail.
  - No price, "saved N times", trending or Corner's sub-chips: mio doesn't give us that data.
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
- **Look and feel:** no emoji, AM/PM times, sleek and clean, Apple-style UX, no redundant labels or disclaimers (emoji are fine on the map dock and pins, Corner-style). **4 Nov: Alex reversed the old "no bottom tab bar / sidebar for cities" rule** and chose an iOS 26 floating tab bar (see Navigation below).
- **Free time:** blank, with suggestions drifting in as day ideas.
- **Durations:** rounded to whole or half hours.
- **Motion:** smooth, light and airy, not bouncy (except the pull stretch, which should feel springy). Revert quickly if a change looks worse.
- **Map motion (4 Nov):** Alex found it too aggressive. Camera `ease` is now cubic-bezier(.3,0,.15,1) (was a quartic that covered half the move in 100ms); `mapAim` 950ms; locate uses one `mapFlyHere` (5 Nov, Alex: it skipped straight to you): an `easeTo` with the same `ease` as places (700–1000ms) when you're within ~2.5 screens, else a `flyTo` with a fixed 1500ms. No `speed`/`maxDuration`: MapLibre jumps instantly when a flight would exceed maxDuration. Pins, card row, chips and buttons use `--glide` (cubic-bezier(.22,.8,.24,1)), no overshoot; picked pin scale 1.26. Pin re-layout mid-move throttled to ~4.5/s.
- **Home-screen app:** updates live. Only the icon and name need a re-add.
- **Place card scrolling (5 Nov, Alex: scroll jumped around):** the old `mpl` scroll listener expanded the card to full once you scrolled 16px, so the card grew under your finger mid-scroll. Removed. At half height `.mpl` doesn't scroll (`overflow-y: hidden; touch-action: pan-x`, so photo strips and chips still swipe sideways); a swipe up on the content is a drag that snaps to full, and only then does it scroll. Swipe down from the top of the scroll goes full → half → closed.
- **Place = two pills (5 Nov, latest; Alex: scrolling to nearby should move the details up, with nearby as its own pill that expands):** in place mode `.mlist.pm` is a transparent column holding two cards in `#mpl`: `.pdet` (grabber/back header + `placeSheet(z, true)`) and `.pnear` (the Nearby pill, `nextNear`). Half height fits the two exactly: `panelFit()` sets `--ph` = details height (measured as if unfolded) + the pill's top row, kept current by a ResizeObserver (photos arriving or failing). Swipe up, tap "Nearby ⌃" (`data-nxo`) or pick a nearby category → `.pfull`: the photos and the blurb/chips fold away (`.pcl` grid-rows 1fr→0fr), leaving the name + Directions card at the top, and the Nearby pill grows to fit its list, its own scroll (`.nxl`) only kicking in when the list is taller than the screen. Alex (5 Nov): two places shouldn't take the whole screen. `panelFit()` also sets `--pf` = folded details + Nearby top row + the shown list, and `.mlist.pm.pfull` top is max(safe area + 62px, bottom − `--pf`); a chip tap re-runs `panelFit()`. Tap the folded details or drag down to come back; drag down from the top of the list too. Opening any place (incl. from Nearby) starts at half. The hotel uses one card (`.pdet.pst`, scrolls itself).
- **One panel on the map (5 Nov, Alex: places felt "on top", not part of the same system):** `#mlist` is the map's single panel. List mode is tall (top = safe area + 118px). Place mode (`.pm`, top = safe area + 30vh, map and pin still visible; scrolling or dragging up goes to `.pfull` at safe area + 66px; dragging down goes full → mid → closed; while a place is open the category rail tucks away (`.mapv.pmode`), so the panel reaches the tab bar; photos are 128px in the panel) renders into `#mpl` via `plRender`, and the panel's `top` animates between the two.
  - **Tap the name to go back (5 Nov, Alex):** tapping the place or hotel name (`.ph-top h3`) in the panel drops it to half height and eases the map back to that place (`mapAim(z, .25)`, re-picks the pin, sets `MUSER` so a fresh location fix doesn't pull it away).
  - Stack `MPS`: `mapPlace(z)` starts fresh (from a card or pin), list rows and nearby rows push (`panelPlace(z, true)`), and the hotel opens as `{ stay }`.
  - The header `.mpl-h` has a grabber and "‹ <previous>" (`panelBack`): back to the previous place, or to the list with a slide from the left.
  - Drag down on the header or the top of the scroll, or tap the map, to close (`panelClose`). Picking a category closes the place.
  - **Video in the panel (5 Nov, Alex: the video player wasn't the same design):** on the map, Video no longer opens the old global sheet. `openVid` sets `PVID = { id, u }` and `plRender` draws the place's own card (`.pdet.pvd`): header "‹ <place>" (back = `panelBack`, clears `PVID`), then `vidBody(u, z)`: the same `.ph-top` as the place (name, kind · rating, Directions pill), the 9:16 player sized to fit, and chips "Open in TikTok/Instagram" + Share. No creator credit (still "not needed"). Swipe up does nothing on it, drag down or tap the map closes; locate hides while it's up. Off the map (Explore, schedule) the sheet uses the same `vidBody` inside `.pvd`. `PVID` is cleared by `panelPlace`, `panelBackTo`, `panelClose` and `panelSync`.
  - `openPlace` routes into the panel whenever the map is up. Clicks inside `#mpl` are not swallowed by the map handler, so video, share and the nearby chips work.
  - The old global `.sheet` is no longer used for places on the map.
- **No page scroll under the map / Explore (5 Nov):** `html:has(> body.mapopen|xpon)` and the body get `overflow: hidden; overscroll-behavior: none` (html always has `overscroll-behavior: none`). Don't use `position: fixed` on the body: on iPhone that left a black strip at the bottom. Going back to the schedule calls `scrollToDay(false)`.
- **Map top (5 Nov):** the map's top bar reuses `.xp-top`, which on Explore paints a bg-to-transparent band. On the map that band is switched off (`.mapv .mtop .xp-top { background: none }`), so the map runs clean under the status bar (Alex saw it as a blur starting too low).
- **Edge to edge (5 Nov, Alex: the app stopped below the camera):** `apple-mobile-web-app-status-bar-style` is now `black-translucent`, so the home-screen app draws under the clock and Dynamic Island. The status text is then always white, so in light mode a soft top shade (`body::after`, standalone + light only) keeps it readable. Headers already pad by `env(safe-area-inset-top)`. Status-bar style is read at launch: if it doesn't change after closing and reopening, the home-screen icon needs re-adding. If Alex dislikes the shade on white pages, the alternative is to go back to `default`.

## Shared state (added 25 Oct)
- `src/worker.js` runs before assets for `/api/*` and `/cal/*` (see `wrangler.jsonc`). KV namespace `europa-trip-shared` (binding `SHARED`) holds one value `state` = `{ key: { v, ts } }`, newest change wins.
- Shared keys: `plan:<iso>` (added stops), `dayplan:<iso>` (Plan the day), `pick:<iso>:<k>`, `cal:<iso>` (calendar lines worked out in the app), `uk-eta`. The app writes through `put()`, pulls on open, every minute and when it comes back to the front.
- The calendar feed is served by the worker: the static `public/cal/<token>.ics` plus the `cal:*` entries. Still rerun `python3 tools/make_ics.py` after changing STAYS, MOVES or EVENTS.

## Explore = city guide (rebuilt 5 Nov)
- Alex: Explore should make it easy to see what there is to do in the city; the map handles "near me now".
- Layout (`xpRender`):
  - Header: large city title (opens the cities sheet), subline "Near you / Around <hotel> · 11° typical" (weather from `wxFor`), week strip.
  - No "Top picks" row (removed 5 Nov at Alex's request).
  - **Themed rows** (`XTH`), horizontal 150px photo cards (`xcCard`: photo or tinted icon, ★ badge, name, one-liner, walk time): Breakfast & brunch, Coffee, Lunch, Dinner, Bars, Something sweet, Museums & galleries, Sights, Views, Parks & nature, Experiences, Clothes & vintage, Shops. Order by time of day comes from `xpThemes`.
  - Each row has "See all N", which opens the map on that category/sub with the list open (`XTH[k].map`, run through `MAPNEXT` once the map has drawn).
  - Tapping a card opens the place sheet.
  - The category chips and the "See all" inline expand were removed from Explore. `xpOrder` and `xpRow` are now unused.
- A full-width small-title bar (`.xp .xp-top .xp-nt`, safe area + 44px) appears only once the week strip has scrolled fully under it (scroll listener compares against `.xp-wk` bottom minus the bar height). Card travel text is shortened like the map's.
- Map list ("See all" on the map) is one grouped block (`.mlg`) with dividers. A solid footer `.mfoot` sits behind the rail and tab bar while it's open. Travel text is shortened ("16 min by metro").

- **Explore header (4 Nov, Alex: top felt messy, not Apple-faithful):** iOS large-title layout. Bar: Cities button left; Map + Schedule are one grouped glass capsule (`.xp-grp`, icons only, no "Schedule" label), same capsule on the map (`#mdone` + `#mcal`). Large title = city, subline = location arrow + "Near you" / "Around <hotel>" (full date if neither). Day pills replaced by a Calendar-style week strip (`.xp-wk`: narrow weekday over date number; today red, selected filled circle, red if today). One chip row only: categories, filled grey (tertiary fill) rather than outlined. On scroll the large title slides under the bar and a centred inline title (`.xp-nt`) fades in (`xp` gets class `sc`, set by a passive scroll listener; re-checked after each `xpRender`).
- **Place cards:** every row has a 64px thumbnail on the left (`ph()`): a tinted icon tile with the photo layered on top, so there's always a picture.
- **Emoji:** map pins keep emoji (`emoOf`). **Icon audit (5 Nov, Alex: Brandenburger Tor had a burger):** `EMO` words now match from the start of a word (`emoHit`), so "burger" no longer hits Brandenburger, "park" sparkles, "cake" pancakes, "scent" Crescent, "pens" open. Entries with a 4th element `1` also match inside compounds (galerie, museum, münster, brücke, markt, pizz, vintage). Groups per kind (`EMOG`) no longer fall across: food kinds use food icons only (dinner also "M" = market/food hall), culture uses sight icons only, see "PF", shop "SF". Sights match on the name first, then the one-liner (Pulteney Bridge 🌉, not 🌊). Added: 🗼 Eiffel/TV tower, 🕰️ clock towers, 🏛️ ruins/temples/monuments/gates/parliaments, 🏔️ alps/mountains, 📚 libraries, 📸 photo booths as a sight, church words in other languages. `EMO_NAME` overrides the few the words get wrong (Gucci Garden, Palazzo Gucci, Monti, Anafiotika, Aiolou Street, Green Door Bar, Hopfenreich). Category chips everywhere, map included, use the drawn icons (`svgI`/`ICON`); `MCHIP` is no longer used. List thumbnails without a photo use drawn icons too.
- **Map chrome matches Explore (4 Nov, Alex: the map felt like a separate app):** the map's top bar is Explore's `.xp-top` with `.pill.glass` buttons. The list icon (`#mdone`) sits where Explore's map icon is, so the two toggle; it closes the map and calls `showXP(true)`. `#mcal` (Schedule) closes the map and calls `showXP(false)`. No city title or blue Done any more. Category chips are Explore's pills at the top (`#mchips.xp-row.xcats`) and stay visible when a pin is picked; the emoji dock and bottom gradient are gone. `MCAT` and `XCAT` are shared both ways. The locate button is a `.pill.glass.ib`. Card row (`.mc`) uses Explore row sizing (64px thumb). Pin hooks are no longer italic. `#mapc { z-index: 0 }` keeps pins under the controls.
- **Map:** OpenFreeMap vector tiles (positron, dark at night; free, no key) drawn by native MapLibre GL 4.7.1 (Leaflet removed 4 Nov for smoothness), recoloured in `tintMap`. Pins are MapLibre HTML markers (`mkMarker`) that morph between states; layout reruns during moves (~7/s) and on moveend. CARTO now needs a key, don't go back to it. No attribution ⓘ button on the map (removed 4 Nov at Alex's request)., mio-style decluttered pins (`layoutPins`): up to 14 labelled bubbles, 12 bare bubbles, the rest dots. Closed places fade.
- **Nearby on a place sheet** (`nextNear`, 5 Nov): a "Nearby" heading, then the map's own category capsules (Alex: reuse the category menu): `DOCK` groups with emoji, colour dot, filled in the pin colour when picked (`.nx-chips .mdc`), membership via `inGrp`, ordered with what usually comes next after this kind first (`NEXT` mapped to groups), then every other group with saves within a 25 min walk. Structure: `.nx-top` (heading + chips) then `.nxl` (lists). One list shows at a time (`[data-nxp]`); tapping a chip swaps the list. Each list is one run, nearest first, everything within a 25 min walk (up to 8); each row's distance line says how far. Kinds with something under 15 min come first. (The "Under 15 / 15–25 min walk" band labels were tried and removed on 5 Nov at Alex's request: just label by distance.) This replaced the stacked "Eat nearby / Something sweet nearby" sections and the "NEAR HERE, NEXT" label. **"all" chip (5 Nov, Alex: see everything close first, then categorise):** the first chip, selected by default, lists everything in any group within a 25 min walk, nearest first (up to 12), and the map shows them all with their lines; the category chips narrow it down as before. It only appears when there are 2+ categories. **Counts (5 Nov, Alex):** each Nearby chip ends with how many places it lists (`.nxn`, grey; white on the picked chip), so the number always matches its list (lists cap at 8 per category, 12 for all).
- **Nearby on the map (5 Nov, Alex: the place you clicked should stay highlighted while you browse its nearby categories, with a connection between them):** one function, `nearSync()`, decides what the map shows from the panel's state; it runs from `plRender`, the chip handler, `panelClose` and a MutationObserver on `#mlist`'s class (so any fold/unfold path is covered). Signature `NSIG` stops repeat work.
  - **Nearby open** (`.pfull` with a chip pressed) → `NEAR = { a, k, list }`: the place stays the picked pin, only it and the listed places show (`pinPool()`), every one labelled where it fits, the hotel pin fades out, and a dotted walking line in each place's pin colour runs from the place to each (MapLibre geojson source `nx`, layer `nx-near`, faded in by `nxDraw`). The camera fits them into the strip of map above the panel (`frameBand`, using `panelTop()` and a `.safe-probe` element for safe areas). Switching chips re-frames.
  - **Panel cap:** with Nearby open the panel stops at 42% of the screen (`.mlist.pm.pfull.nx`) so the map stays visible; the list scrolls inside. This overrides the earlier "grow to fit the list" note for place mode.
  - **Trail:** opening a place from Nearby pushes it (`MPS`), and `TRAIL` keeps every place in the stack on the map: earlier ones ringed and labelled in blue (`.mp.org`), joined by a solid blue line with a casing (`nx-trail`, `nx-trail-c`). At half height the camera frames the last two (maxZoom 17.2 so close pairs don't overlap). Back (`panelBack` → `panelBackTo(i)`) restores that place's Nearby category and height (`it.nk`, `it.back`). `nextNear(z, nk)` takes the chip to show.
  - **Taps on the map while a place is open (`pinTap`):** the place itself → fold back to details; a trail pin → back to that place; a nearby pin → open it (pushed, line follows); any other pin → opens fresh (before this, tapping another pin left the old place in the panel). Tapping empty map goes full → half → closed.
  - Lines are straight, not routed (no paid routing). Lines are re-added after a theme/style change via `styledata` → `nxLayers()`.
- **Directions start from you (5 Nov, Alex: Google didn't use his position):** `dirs()` still builds destination-only links, and a capture click listener adds `origin=lat,lng` from `HERE` at tap time when the fix is under 20 min old. Without a fix Google picks the start as before.
- **Opening hours:** removed at Alex's request (Google cost). Don't add paid lookups without asking.
- **Map picking (mio style):** tapping a pin calls `mapPick`: the pin grows with a stem, the map slides it to the upper third (`mapAim`), the category row gives way to a swipeable card row (`#mcar`, the pick plus the 24 nearest), No name pill at the top (removed 4 Nov, Alex: the card already shows the name); `#mselx` stays in the DOM hidden. Tap empty map to clear. Swiping cards moves the pick and the map. Tapping a card opens the place sheet at ~56vh so the map stays visible. Tapping empty map clears it. **Pin taps (4 Nov):** name labels (`.mp .t`, and `.mp` itself) take no touches; only the bubble/dot (`.mp .b`, plus the 40px `.pinw`) does, and hidden pins' wrappers are `pointer-events: none`. A tap that misses every pin falls through to `MAP.on("click")`, which checks `labelAt()` (topmost label under the finger, incl. the hotel) and calls `pinTap()`. Reason: the picked pin's label sat above nearby dots and kept re-opening the same place. Place sheets show photos as a mio-style strip (`.gal.strip`).

- **Place sheets:** no "Saved from" credit (Alex: not needed). The search button is Google (`gq`), not TikTok. No prices: mio doesn't expose price level and Alex won't pay for Google lookups.
- **Place sheet layout (5 Nov, compact):** photo strip (150px everywhere) → header row `.ph-top`: name (24px, `text-wrap: pretty`; the global `balance` made names break after one word) with `placeMeta` (kind · rating, plus "On the day, <time>" in blue when added) underneath, and a blue Directions pill `.pgo` beside it showing the turn arrow + walk time (`.pdist`, refreshed by `refreshSheetDist`) → hook full width (`.pl-tl`, 16px) → small chips `.pmini`/`.pchip`: Video, Share (`data-pshare`), Google → Nearby chips. **Alex removed the save/add-to-day button on 5 Nov** ("it'll never be used"); the `data-zadd` handler is still in the code but nothing renders it. Icons are in `PI`/`pI`.
