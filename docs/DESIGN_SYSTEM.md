# Xapp design system

The look: violet (البنفسجي) glowing into pure black, white primary buttons, deep violet cards with a light edge, and colour used sparingly. (It started from the navy banking-app reference; the owner then chose purple.) The rules below come from the owner's UI/UX brief. Code: `apps/mobile/src/lib/palette.ts`, `src/theme.ts` and `src/components/`.

## Colour and surfaces

| Token | Dark (default, OLED) | Use |
|---|---|---|
| `background` | `#000000` | Level 0. Pure black saves battery on OLED screens. |
| `backgroundGlow` | `#3B0F7A` | Violet glow at the top of home screens (`<Screen glow>`). |
| `surface` | `#130D22` | Level 1: cards and bento tiles. |
| `surfaceRaised` | `#1C1430` | Level 2: bottom sheets, the menu, the home panel. |
| `surfaceFloating` | `#261C3D` | Level 3: toasts, callouts. |
| `rim` + `rimHighlight` | `rgba(221,214,254,0.16)` + inner top line `rgba(255,255,255,0.12)` | The light edge: a fine lavender border plus a brighter top line, as if lit from above (`rim()` in theme.ts). |
| `hero` → `heroEnd` | `#5B21B6` → `#1E0B45` | Violet focus modules (balance, new request). The text on them is always white. |
| `cta` / `onCta` | `#FFFFFF` / `#1E0B45` | The screen's main action: a white pill (deep violet in light mode). |
| `primaryFill` | `#5B21B6` | Other filled actions, selected chips, my chat bubbles. `primary` (`#C4B5FD`) is the lavender used for accent text and icons. |
| `control` | `#352A4F` | Neutral round buttons. |
| `location` | `#4C8DF6` | The blue "you are here" dot, as in every map app. |

- **Modes:** there is also a light palette and a high-contrast variant of each. The user picks Dark, Light or Automatic in Settings. Dark is the default.
- **Contrast:** every text and background pair passes **WCAG AAA (7:1)**. `src/lib/contrast.test.ts` checks this (`npm test`), so a colour change that breaks contrast fails the tests.
- **Brand colours:** WhatsApp, Waze and Google Maps colours are used only on their own icons (`constants/brands.ts`).

## Glass (only for floating, temporary parts)

`<Glass>` is used for the ☰ and locate buttons, toasts, auto-hiding headers, sticky footers and the chat header.

- **iOS 26 and later:** the system Liquid Glass (`expo-glass-effect`), with real refraction.
- **Older iOS and browsers:** background blur, a tinted layer, and a highlight along the top edge.
- **Android:** an opaque floating surface. Live blur is costly on many Android phones.
- **Reduce transparency (phone setting, browser setting or the in-app switch) and high contrast:** fully opaque.

Long text and primary content always sit on opaque cards.

## Layout

- **Margins and gaps:** outer margins are 16, and the gap between modules is 12.
- **Corners:** cards and tiles use a 22 radius, sheets 28, and buttons are pills.
- **Bento grids** (`components/bento.tsx`) are used on the client home, the driver home and the profile:
  - 1x1 tiles for single numbers;
  - 1x2 tall tiles beside a stack of two 1x1 tiles;
  - 2x1 banners for live controls (the trip in progress, the next booking);
  - 2x2 or 2xauto focus modules (new request, wallet).
- **Navigation: the ☰ menu** (as in inDrive), in the top start corner: top-left in French and English, top-right in Arabic. It slides in from that side (swipe it back to close) and holds the profile, history of requests / offers / trips, bookings, wallet, vehicle and documents, settings, language and switching between client and driver.
- **Thumb zone:** the main actions stay at the bottom: the client home's "Where to?" panel, main buttons pinned on a glass footer, the next-step callout, and lists that open as bottom sheets.
- **Client home is map first:** the map with the blue location dot and the pickup pin on top (a "We couldn't find you, tap to turn on location" banner when GPS is off), and a panel with one question, "Where to?", recent places and the bento tiles.
- **Dissolving header:** a `<Screen header>` floats on glass, hides when scrolling down, and springs back when scrolling up.
- **Predictive callout:** one card at the bottom of the screen shows the most likely next step. Depending on the situation this is:
  - client: track the driver, or resume a draft (with its progress);
  - driver: continue the trip, pickup soon, or low wallet.

## Motion

- **Springs everywhere:** the presets in `lib/motion.ts` (damping 15–20, stiffness 150–200) replace fixed-duration easings.
- **Where they run:** presses, sheets, toasts, the dock callout, segmented toggles, the slide-to-confirm button and the hiding headers all run on the UI thread (Reanimated).
- **Reduce motion:** every spring follows the system "Reduce motion" setting.
- **Exceptions:** looping ambient animations (the radar pulse while waiting for offers, the recording dot) keep a steady rhythm on purpose.

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
- **Where it's used:** confirmations, leaving the request form, the map and city pickers, my requests, and upcoming bookings.
- **Navigation sheets:** Settings and Language open as native form sheets.

## Maps and places

- **Maps:** phones use the system maps (Apple Maps on iPhone, Google Maps on Android) with the phone's own location dot. Browsers use OpenStreetMap street tiles (CARTO style); pages that block outside images, like the claude.ai preview, fall back to the bundled outline of Morocco with the place names drawn on it.
- **Place suggestions:** about 830 places work offline: the main cities, 440+ towns from GeoNames, and hand-picked neighbourhoods, streets, markets, ports, stations and industrial zones (`scripts/data/places-ma.txt`). The search forgives typos and spelling variants and puts nearby places first. Where the internet allows, street addresses from OpenStreetMap (Photon) are added under "Addresses".
