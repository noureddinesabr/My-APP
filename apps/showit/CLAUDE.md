# Xapp Show it (test app)

A separate, simple Expo app (`ma.xapp.showit`) for testing the "Show it, say it" idea: the customer shows the load (photo), adds a recorded voice note and/or says the trip in words (keyboard dictation), the AI fills a booking card, drivers offer, and the trip runs to a delivery code. Design: warm white + burnt orange (#C2410C) for customers, ink dark for drivers; Plus Jakarta Sans, Noto Kufi Arabic for Arabic text. Keep this look.

- Everything is stored on the phone (`src/store.ts`, AsyncStorage); switching Customer/Driver at the top tests both sides. Two example offers (clearly labelled) arrive after sending, and an accepted example driver moves the trip on by itself.
- AI: `src/ai.ts` calls Claude with the Anthropic TypeScript SDK using an API key the tester enters in Settings (kept on the phone only). No key means the card is filled by hand. A real launch needs a backend so no key ships in the app.
- Vehicles: `src/vehicles.ts`, nine 3D renders in `assets/vehicles/` (copied from apps/mobile).
- Voice notes: `useVoiceRecorder` / `VoicePlayer` in `src/ui.tsx` (expo-audio).
- APK: `.github/workflows/showit-apk.yml` builds on pushes touching `apps/showit/**` and publishes the `showit-apk` pre-release.
- Before pushing: `npm run typecheck` and `npx expo export --platform android` must succeed.
