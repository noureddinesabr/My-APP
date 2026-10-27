# Xapp UX Principles

Every screen and flow in Xapp (mobile app and admin panel) must follow these six principles. When building a feature, check it against this list.

## The six rules

1. **Smart defaults.** Never show a blank form or an empty selection. Pre-fill the most common choice so the user only scans and adjusts. Button labels say what the user gets ("See 4 suitable trucks"), never generic "Submit" or "Next".
2. **Goal gradient.** Never show 0% progress. Count what the user already did (chose language, chose account type, started a draft) as completed steps, so progress starts at 20% or more. Always show a clear, linear progress bar toward a concrete finish.
3. **Reciprocity.** Give real value before asking for an account: price estimate, suitable vehicles, route distance, sample loads for drivers. Ask to sign up only *after* that value is on screen.
4. **IKEA / endowment.** Let users build and personalize before registration (their request, their vehicle profile). Keep it in local storage. Move to sign-up with a continuing action ("Send my request to drivers") rather than a hard "Sign up" wall.
5. **Loss aversion.** At decision points, show what the user would lose (their draft, offers about to expire, matching loads they would miss). The dismiss button states that consequence plainly.
6. **Contrast / anchoring.** Never show a fee alone. Put it next to the bigger number it relates to ("+80 MAD helpers — 15% of your trip", "Commission 120 MAD on a 1,200 MAD job — you keep 1,080").

## Simplicity

Xapp is for everyday people, not only people who are good with phones. Each screen fits in one phone view and asks one thing; extra information lives behind one tap (the ☰ menu, "See all vehicles", the chat). Prefer a picture, an icon or a number over a sentence. Celebrate the big moments (request sent, driver booked, delivered) with a short animation and sound.

## Honesty guardrails

These principles must build trust, not trick people. Drivers and clients in Morocco talk to each other, and one bad experience spreads.

- Progress counts **only real completed steps**. No fake steps.
- Numbers on screen (drivers nearby, typical prices, matching loads) are **real data or clearly labelled as an estimate**. Never invented.
- Dismiss buttons describe the real consequence in neutral words ("Discard draft"), never shaming ("No, I like overpaying").
- Fees are always shown in full before the user commits.

## How each principle fits the user journeys

### Client: posting a request

| Step | What happens | Principles |
|---|---|---|
| Open app | Language picked automatically; choose "I want to send freight". No login. | 1, 3 |
| Request flow: one question per screen (Trip → What → How big → Vehicle → When → Helpers → Anything else → Price) | Like a game level: one big question, a few big answers, tap one and the next question slides in. Nothing scrolls. Progress starts at **20%**: account type and destination are already done. Every answer is pre-filled: pickup = current location, when = now, freight type = most common, size = typical for that type, vehicle = best fit, helpers = 0, price = suggested fair price. | 1, 2 |
| Buttons | "See 3 suitable vehicles", "See fair price", "Send my request to drivers" | 1, 4 |
| Value preview (before login) | Card with distance, travel time, suggested price range, suitable vehicles, and drivers active in the area (real count, or "estimate"). | 3 |
| Sign-up | Only when sending the request: phone + SMS code. The draft stays saved on the phone and is sent right after login. | 3, 4 |
| Map-first start | The pickup defaults to where the phone is; one question, "Where to?", with suggestions from the first letters and recent places one tap away. Nothing else on the home screen. | 1, 2 |
| Voice note, photos, videos | Optional, in the "Anything the driver should know?" question (with Skip): one tap to record, one tap to keep. Files are saved as soon as they are taken, so they stay in the draft before sign-up and are sent with the request. The hint says what they do ("help drivers see the size and price it right") and makes no promise about more or cheaper offers. | 1, 4 |
| Leaving the wizard | "Keep my draft" / "Discard draft". The draft is restored next time with progress kept. | 4, 5 |
| Extras | Helpers, insurance, express shown relative to the trip price ("+80 MAD, 15% of your trip"). | 6 |
| Offers | Each offer shown against the suggested fair price ("50 MAD below typical price"). Expiry shown: "This offer expires in 12 min". | 5, 6 |

### Driver: joining and earning

| Step | What happens | Principles |
|---|---|---|
| Choose "I'm a driver" | Can immediately browse loads in their city with estimated earnings, before signing up. | 3 |
| Vehicle profile | Picks vehicle type (capacity pre-filled from type), home city (from location), preferred routes. Saved locally. | 1, 4 |
| Verification checklist | Starts at **40%**: "Account type chosen ✓, Vehicle added ✓", then ID, licence, carte grise, insurance. | 2 |
| Sign-up | "Save my truck and start receiving loads", then phone + SMS code. | 4 |
| Sending an offer | Price pre-filled with the suggested price; commission shown against it: "Commission 10%: 120 MAD on 1,200 MAD — you keep 1,080 MAD". | 1, 6 |
| Low wallet balance | "Top up to keep receiving loads: 4 loads match your route today." Dismiss: "Pause new offers". | 5, 6 |
| Top-up | Amounts shown with what they cover: "200 MAD ≈ commission on 2,000 MAD of jobs". Default amount pre-selected. | 1, 6 |

### Company (fleet)

Same as driver, with a fleet checklist that starts with "Company account chosen ✓" and the first vehicle pre-filled from the most common fleet truck (3.5 t).

### Admin panel

Smart defaults on every list: verification queue opens on "Pending, oldest first"; dashboards default to "Last 7 days, Casablanca + all Morocco".

## Technical approach

- **Pre-login state:** a local draft store (React context + AsyncStorage on mobile) holds the request draft, vehicle profile and preferences. It survives app restarts and is uploaded to the server right after sign-up.
- **Shared components** (in `apps/mobile/src/components/`):
  - `ProgressSteps`: linear progress bar that counts already-completed steps
  - `DynamicButton`: CTA whose label includes the outcome/count
  - `ValuePreviewCard`: shows estimate, vehicles, drivers before login
  - `AnchoredPrice`: fee displayed next to its anchor total with a relative label
  - `DraftExitPrompt`: keep/discard prompt showing what would be lost
