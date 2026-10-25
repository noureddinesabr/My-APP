# Xapp — Version 1 Plan

A freight-only marketplace for Morocco. A client posts a load to move from A to B, drivers send offers, and the client picks one.

## Decisions so far

| Topic | Decision |
|---|---|
| Platforms | Android + iPhone app, plus a web admin panel for the owner |
| Languages | Arabic (standard, right-to-left), French, English. Follows the phone's language (French if the phone uses another language); can be changed in settings |
| Payment | Client pays driver **in cash**. Online payment later |
| Revenue | **Commission per job, 8–10%** (default 10%, adjustable by admin), collected through a prepaid driver wallet (see below) |
| Coverage | All of Morocco, city-to-city included. Marketing focus: Casablanca |
| Drivers | Independent drivers **and** transport companies (fleet accounts) |
| Name | **Xapp** (working name until the final name is chosen) |

## How commission works with cash

The client pays the driver in cash, so the app cannot take its share at payment time. Instead:

1. Each driver (or company) has a **wallet** in the app.
2. The driver tops up the wallet (v1: bank transfer or cash agent such as CashPlus / Wafacash, then the admin confirms it in the panel; later: card payment).
3. When the client accepts a driver's offer, the commission (8–10% of the offer price, set by the admin) is deducted from the wallet.
4. If the wallet balance is too low, the driver cannot send new offers until they top up.

This is the same model used by ride apps in Morocco and avoids chasing drivers for unpaid commission.

## Users and roles

- **Client (shipper)** — individual or business sending freight.
- **Driver** — owns or drives one vehicle.
- **Company (fleet)** — owner account that adds several vehicles and drivers, receives requests, assigns jobs to its drivers, and shares one wallet.
- **Admin** — you, through the web panel.

One mobile app; the user picks their role at sign-up. Login by **phone number + SMS code**.

## Version 1 features

### Client
- Post a request: pickup and drop-off on a map, date/time (now or scheduled), freight type (furniture, construction materials, goods/pallets, food, machinery, other), weight in kg/tons, size, photos, notes, number of loading helpers needed.
- Required vehicle type (or "let drivers suggest").
- **Suggested fair price** shown based on distance, weight and vehicle type; client sets their own price.
- Receive offers live: price, vehicle, driver rating, number of completed jobs, verified badge, arrival time.
- Accept an offer, then chat and call the driver.
- Live tracking of the driver on the map.
- Confirm delivery, rate the driver.
- History of past requests.

### Driver / company
- Sign-up with document verification: CIN, driving licence, vehicle registration (carte grise), insurance, vehicle photos. Cannot send offers until approved by admin.
- Vehicle profile(s): type, capacity in tons, photos, plate number.
- Feed of open requests filtered by distance, vehicle capacity and route; long-distance requests included.
- **Return trip mode**: "I'm going back from Casablanca to Fes on Friday" so they get matching requests.
- Send an offer (price + arrival time + message), counter-offer.
- Job flow: on the way → loaded → delivered (with delivery photo).
- Wallet: balance, top-up instructions, commission history.
- Ratings of clients.
- Company accounts: manage vehicles and drivers, assign accepted jobs.

### Admin panel (web)
- Approve / reject driver and company documents.
- See all requests, offers and jobs; live map of active jobs.
- Users: search, suspend, ban.
- Wallets: confirm top-ups, set commission %, view earnings.
- Complaints and disputes.
- Settings: vehicle types, freight types, price formula.
- Statistics: requests per day, acceptance rate, top cities, revenue.

### Both sides
- Push notifications (new offer, offer accepted, driver arriving, etc.).
- Arabic / French / English with automatic detection and manual switch.

## Vehicle types (editable by admin)

Triporteur · Small van (Kangoo/Berlingo) · Pickup · Truck 3.5 t · Truck 7 t · Truck 12 t+ · Semi-trailer · Refrigerated · Flatbed

## Later versions (not in v1)

Online card payment · cargo insurance · multiple stops · business accounts with invoices · referral program · Darija marketing content.

## Technology

- **Mobile app:** React Native with Expo (TypeScript) — one codebase for Android and iPhone, good right-to-left Arabic support.
- **Admin panel:** Next.js website (TypeScript).
- **Backend:** Supabase — database (PostgreSQL), phone login, real-time offers/chat/tracking, file storage for documents and photos.
- **Maps:** Google Maps (map, address search, distances).
- **Notifications:** Expo push notifications.
- **Translations:** i18next with phone language detection.

Everything lives in this repository:

```
apps/mobile    – the phone app
apps/admin     – the admin website
supabase/      – database structure, security rules, server functions
docs/          – plans and documentation
```

## Accounts the owner will need (when we get there)

- Supabase (free to start)
- Google Cloud for Maps (free monthly credit, then pay per use)
- SMS provider for login codes
- Apple Developer ($99/year) and Google Play Developer ($25 once) to publish
- A registered company in Morocco before collecting commission

## Build order

1. ✅ Project setup, languages + right-to-left, design system and app name/colors.
2. ✅ Client: post a request (wizard with price estimate, saved on the phone before sign-up).
3. ✅ Test login by phone (code shown on screen), request sent right after sign-up.
   ✅ Live test mode: client ↔ driver in real time (offers, accept, live map tracking with simulated or real GPS, trip steps, chat, ratings, wallet commission), place search with suggestions, map picking, sound effects.
   Next: hosted backend (Supabase) with real SMS codes, so the phone apps share data outside the preview.
4. ✅ Driver (test mode, on the device): vehicle, documents, test approval, sample loads, sending offers. Next: real accounts and admin approval.
5. Client: receive and accept offers; chat.
6. Job flow, live tracking, delivery confirmation, ratings.
7. Wallet and commission.
8. Admin panel.
9. Company/fleet accounts.
10. Testing, then publishing to the stores.
