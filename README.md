# Xapp

Freight delivery marketplace for Morocco: clients post a load, drivers send offers, the client picks one.
Available in Arabic, French and English.

See [docs/PLAN.md](docs/PLAN.md) for the full plan and [docs/UX_PRINCIPLES.md](docs/UX_PRINCIPLES.md) for the UX rules every screen follows.

## Structure

```
apps/mobile   – phone app for Android and iPhone (React Native + Expo)
apps/admin    – admin web panel (coming later)
docs/         – plan and documentation
```

## Run the phone app

```bash
cd apps/mobile
npm install
npx expo start        # scan the QR code with the Expo Go app on your phone
npx expo start --web  # or open it in the browser
```

Checks:

```bash
npm run typecheck
npm run lint
npm test
```

## Screenshots

| Welcome | Route (step 1) | Load (Arabic) | Vehicle (Arabic) |
|---|---|---|---|
| ![](docs/screenshots/fr-0-welcome.png) | ![](docs/screenshots/fr-3-route-city.png) | ![](docs/screenshots/ar-5-load-helper.png) | ![](docs/screenshots/ar-6-vehicle.png) |

| Price estimate | Sign-up after estimate | Keep draft? (Arabic) | Resume draft (Arabic) |
|---|---|---|---|
| ![](docs/screenshots/fr-7-price.png) | ![](docs/screenshots/fr-8-signup.png) | ![](docs/screenshots/ar-9-exit.png) | ![](docs/screenshots/ar-10-client-resume.png) |

| Access & item options | Date & time picker | Driver checklist | Documents | Verified driver | Sending an offer |
|---|---|---|---|---|---|
| ![](docs/screenshots/c1-load-access.png) | ![](docs/screenshots/c2-when.png) | ![](docs/screenshots/d1-home.png) | ![](docs/screenshots/d3-documents.png) | ![](docs/screenshots/d5-approved.png) | ![](docs/screenshots/d6-offer.png) |

### Live client ↔ driver test

| Offer arrives | Driver home | Driver trip | Client tracking | Done |
|---|---|---|---|---|
| ![](docs/screenshots/live-06-client-offer.png) | ![](docs/screenshots/live-04-driver-home.png) | ![](docs/screenshots/live-08-driver-job.png) | ![](docs/screenshots/live-09-client-tracking.png) | ![](docs/screenshots/live-12-client-done.png) |

### Automatic trips, bookings, chat and profiles

| Booking (driver) | At drop-off: code + slide | Client: booked + code | Chat with trip events | Driver profile |
|---|---|---|---|---|
| ![](docs/screenshots/scheduled-04-driver-booked.png) | ![](docs/screenshots/scheduled-08-driver-dropoff.png) | ![](docs/screenshots/scheduled-02-client-after-accept.png) | ![](docs/screenshots/scheduled-10-driver-chat.png) | ![](docs/screenshots/scheduled-12-driver-profile.png) |
