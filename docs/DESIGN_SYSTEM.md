# Xapp design system

The look (Phase 2, design system v2): a professional logistics interface — **light by default**, deep **navy** structure, a **blue** accent for actions and links, **teal** for live and location information, green for success, red for problems. Dark mode is a deep navy version of the same tokens. (Earlier rounds used violet on black; Phase 2 replaced it as the handoff asked.) Code: `apps/mobile/src/lib/palette.ts`, `src/theme.ts`, `src/components/ui.tsx` and `src/components/ds.tsx`.

## Colour and surfaces

| Token | Light (default) | Use |
|---|---|---|
| `background` | `#F4F6F9` | Level 0, a cool off-white. |
| `surface` / `surfaceRaised` / `surfaceFloating` | `#FFFFFF` | Cards (1), sheets (2), toasts (3). Depth comes from the rim and shadow, not colour. |
| `surfaceMuted` | `#EDF1F6` | Inputs, unselected chips, empty bars. |
| `cta` / `onCta` | `#142B49` / `#FFFFFF` | The screen's one main action: solid navy (white in dark mode). |
| `hero` → `heroEnd` | `#142B49` → `#0B1A2F` | Navy summary modules; text on them is always white. |
| `primary` / `primaryFill` | `#1746A2` | Blue: links, icons, outlines, selected states, filled badges with `onPrimary`. |
| `teal` / `location` | `#0B7A70` | Live GPS, "you are here", live trips, capacity left. |
| `success` / `successFill` | `#07514A` / `#0A5C47` | Done, paid, confirmed, savings. |
| `accent` / `accentFill` | `#951B12` / `#A3221A` | Problems, cancellations, destructive actions, overdue. |
| `star` | `#6B4400` | Ratings. |
| `text` / `textMuted` | `#0F1E33` / `#3A4A63` | Body and secondary text. |

- **Modes:** light (default), dark navy, and a high-contrast variant of each; the user picks in Settings.
- **Contrast:** every text and background pair passes **WCAG AAA (7:1)**; `src/lib/contrast.test.ts` checks it (`npm test`).
- **Status colours** (`StatusBadge` in `ds.tsx`) always pair a colour with an icon and a word, never colour alone: neutral (draft, cancelled), blue (pending, accepted, published), teal (in transit, live), green (confirmed, delivered, completed, paid, verified), gold (prototype), red (disputed, overdue, suspended).
- **Prototype label:** anything backed by sample data or local test state carries the gold `PrototypeNote` / "Prototype" tag (honesty rule: never present mock operations as real).
- **Brand colours:** WhatsApp, Waze and Google Maps colours only on their own icons (`constants/brands.ts`).

## Type and density

- **Fonts:** Inter for Latin text (English, French), Tajawal for Arabic — swapped automatically by `Text` and `TextInput` (`arabicFont()` in `theme.ts`).
- **Sizes** (`components/text.tsx`): body and labels 17, captions 15 (nothing a person must read is smaller), subtitles 19, titles 24, questions 28–30, big numbers 40.
- **Corners:** `Radius` sm 10, md 12 (buttons, inputs), lg 16 (cards), xl 20 (sheets), pill for chips.
- **Less on each card:** where, how much, one short line. Everything else is one tap away.
- **Calm colour:** blue for actions, teal for live, green for done, red for problems; everything else neutral navy-grey.

## Components (`components/ds.tsx`, `ui.tsx`, `route-cards.tsx`)

`Button` (accent = navy main action, primary, outline, ghost, danger; `compact`), `StatusBadge`, `Tag`, `PrototypeNote`, `StateView` (loading / empty / error / offline / success, with an optional action), `ConfirmDialog` (optional required reason, used for every admin override and kept in the audit log), `FormField` (label, hint, inline error, suffix), `SelectField`, `ToggleRow`, `OptionCards`, `FilterChips`, `SectionHeader`, `ListRow`, `InfoRow`, `PriceBreakdown` (original price, discounts, total), `Stat`, `PageHeader`, `StepIndicator` ("Step 2 of 5"), `RouteCard`, `BookingCard`, `CapacityBars` (weight, volume, seats). Admin: `AdminShell` (side navigation grouped Monitor / Marketplace / People / Finance / System, collapses to a menu on narrow screens), `DataTable`, `Toolbar`, `DetailLayout`, `Panel`.

## Glass (only for floating, temporary parts)

`<Glass>` is used for the ☰ and locate buttons, toasts, auto-hiding headers, sticky footers and the chat header.

- **iOS 26 and later:** the system Liquid Glass (`expo-glass-effect`), with real refraction.
- **Older iOS and browsers:** background blur, a tinted layer, and a highlight along the top edge.
- **Android:** an opaque floating surface. Live blur is costly on many Android phones.
- **Reduce transparency (phone setting, browser setting or the in-app switch) and high contrast:** fully opaque.

Long text and primary content always sit on opaque cards.

## Layout

- **Margins and gaps:** outer margins are 16, and the gap between modules is 12.
- **Bento grids** (`components/bento.tsx`) are used on the client home, the driver home and the profile:
  - 1x1 tiles for single numbers;
  - 1x2 tall tiles beside a stack of two 1x1 tiles;
  - 2x1 banners for live controls (the trip in progress, the next booking);
  - 2x2 or 2xauto focus modules (new request, wallet).
- **Navigation (Phase 2): bottom tabs.** Customer: Home, Bookings, Messages, Account. Driver: Home, Routes, Jobs, Earnings, Profile. The notification bell sits in the top end corner of home screens. Admin (desktop): a side navigation, with a top menu button on narrow windows. Switching between customer and driver is in Account / Profile.
- **Thumb zone:** the main actions stay at the bottom: the client home's "Where to?" panel, main buttons pinned on a glass footer, the next-step callout, and lists that open as bottom sheets.
- **Safe frame:** one `SafeAreaView` in `app/_layout.tsx` keeps every screen clear of the status bar, camera cut-out, rounded corners and Android's navigation bar. Screens never add the insets again; only layers inside a `Modal` (sheets, the menu, the media viewer) do.
- **Client home is map first:** the map with the blue location dot and the pickup pin (a small "Turn on location" pill when GPS is off), and under it one big white "Where to?" button with up to three recent places. Nothing else.
- **One question per screen** (`components/motion/quest.tsx`): `QuestScreen` (back, thick progress bar, close; the question in big words; the answers; at most one button), `ChoiceCard` answers (tap = pop sound + tick, then the next question slides in after ~0.3 s via `useAutoAdvance`). Nothing scrolls on a normal phone.
- **Dissolving header:** a `<Screen header>` floats on glass, hides when scrolling down, and springs back when scrolling up.
- **Predictive callout:** one card at the bottom of the screen shows the most likely next step. Depending on the situation this is:
  - client: track the driver, or resume a draft (with its progress);
  - driver: continue the trip, pickup soon, or low wallet.

## Motion

- **Springs everywhere:** the presets in `lib/motion.ts` (damping 15–20, stiffness 150–200) replace fixed-duration easings.
- **Where they run:** presses, sheets, toasts, the dock callout, segmented toggles, the slide-to-confirm button and the hiding headers all run on the UI thread (Reanimated).
- **Reduce motion:** every spring follows the system "Reduce motion" setting.
- **Exceptions:** looping ambient animations (the radar pulse while waiting for offers, the recording dot) keep a steady rhythm on purpose.

## Motion graphics (`components/motion/`)

Explainer-video style animation, all on the UI thread and all still when "Reduce motion" is on:

- **Page transitions:** a new question slides in from the reading side (from behind when going back); its words rise in one by one (`KineticTitle`) and the answers follow in a stagger (`Rise`).
- **Scenes** (`scenes.tsx`, SVG + Reanimated): `TruckScene` (the Xapp truck driving through a parallax city, mirrored in Arabic; empty states), `Radar` (looking for drivers), `SuccessBurst` (a disc springs in, the tick draws itself, confetti bursts).
- **Celebrations** (`celebration.tsx`): full screen for 2–3 s, tap to close. Client: request sent, driver booked, delivered. Driver: offer sent, "You got the job!" (on the home or the load), delivered with the amount earned.
- **Progress bar** (`QuestProgress`): thick violet gradient that springs forward, a band of light running through it continuously, and the percentage inside counting up.
- **Living details** (`effects.tsx`): a light sweep across main buttons, slide buttons, the trip-in-progress tile and status banners (`Shimmer`); pulsing "live" dots (`PulseDot`); floating banner icons (`Float`); numbers that count up and pop (`CountUp`: prices, wallet, earnings, offer and load counts); the slide button's arrow nudging forward (`Nudge`); status banners spring in when the status changes; menu rows slide in after the drawer; pages fade in.
- **Sounds:** `pop` (an answer picked), `whoosh` (moving on), `celebrate` (big moments), plus the earlier tap, send, offer, success, step, complete and error.

## Haptics (`lib/haptics.ts`)

| Moment | Haptic |
|---|---|
| Chip, tab, toggle or segmented change; stepper repeat; slide reaching the confirm point | selection |
| Button press | light |
| Message sent, sheet dismissed, dock main action | medium |
| Offer accepted, delivery done, slide confirmed | success |
| Refused action (wrong code, missing permission) | warning |
| Hitting a limit (stepper min/max, pulling a sheet past its top) | rigid |

- **iPhone:** uses the Taptic Engine.
- **Android:** uses the vibrator.
- **Android browsers:** use short vibration patterns.
- **iOS Safari:** has no web vibration, so there is visual feedback only.

## Sheets

`components/sheet.tsx` is a draggable bottom sheet.

- **Closing:** it follows the finger. Dragging past 30% of its height, or flicking down faster than 900 pt/s, closes it. Tapping outside or the system back button also closes it.
- **Drag area:** sheets that contain maps or lists can only be dragged by the handle (`drag="handle"`).
- **Where it's used:** confirmations, leaving the request form, place search, the map picker, choosing a day and time, and "See all vehicles".
- **Navigation sheets:** Settings and Language open as native form sheets.

## Maps and places

- **Maps:** phones use OpenStreetMap streets through MapLibre (free OpenFreeMap styles, light and dark, no API key) with the phone's own blue location dot. Browsers use OpenStreetMap street tiles (CARTO style); pages that block outside images, like the claude.ai preview, fall back to the bundled outline of Morocco with the place names drawn on it.
- **Place suggestions:** about 830 places work offline: the main cities, 440+ towns from GeoNames, and hand-picked neighbourhoods, streets, markets, ports, stations and industrial zones (`scripts/data/places-ma.txt`). The search forgives typos and spelling variants and puts nearby places first. Where the internet allows, street addresses from OpenStreetMap (Photon) are added under "Addresses".
