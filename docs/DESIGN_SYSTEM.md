# Xapp design system

The look is based on the reference banking app the owner chose: deep navy that fades into black, white primary buttons, slate cards, and colour used sparingly. The rules below come from the owner's UI/UX brief. Code: `apps/mobile/src/lib/palette.ts`, `src/theme.ts` and `src/components/`.

## Colour and surfaces

| Token | Dark (default, OLED) | Use |
|---|---|---|
| `background` | `#000000` | Level 0. Pure black saves battery on OLED screens. |
| `backgroundGlow` | `#01386C` | Navy glow at the top of home screens (`<Screen glow>`). |
| `surface` | `#10151D` | Level 1: cards and bento tiles. |
| `surfaceRaised` | `#1A212C` | Level 2: bottom sheets. |
| `surfaceFloating` | `#262E3A` | Level 3: toasts, the dock, callouts. |
| `rim` | `rgba(255,255,255,0.08)` | 1 px border on dark cards, used instead of heavy shadows. |
| `hero` → `heroEnd` | `#0B4A8C` → `#021B38` | Navy focus modules (balance, new request). The text on them is always white. |
| `cta` / `onCta` | `#F5F7FA` / `#0B1220` | The screen's main action: a white pill (black in light mode). |
| `primaryFill` | `#1D47C2` | Other filled actions, selected chips, my chat bubbles. |
| `control` | `#3A4250` | Neutral round buttons (as in the reference). |

- **Modes:** there is also a light palette and a high-contrast variant of each. The user picks Dark, Light or Automatic in Settings. Dark is the default.
- **Contrast:** every text and background pair passes **WCAG AAA (7:1)**. `src/lib/contrast.test.ts` checks this (`npm test`), so a colour change that breaks contrast fails the tests.
- **Brand colours:** WhatsApp, Waze and Google Maps colours are used only on their own icons (`constants/brands.ts`).

## Glass (only for floating, temporary parts)

`<Glass>` is used for the dock, toasts, auto-hiding headers, sticky footers and the chat header.

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
- **Thumb zone:** navigation and main actions sit at the bottom.
  - The floating **Dock** has text labels under every icon and one main action in the middle.
  - Main buttons are pinned on a glass footer.
  - Lists open as bottom sheets.
- **Dissolving header:** a `<Screen header>` floats on glass, hides when scrolling down, and springs back when scrolling up.
- **Predictive callout:** one card above the dock shows the most likely next step. Depending on the situation this is:
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
