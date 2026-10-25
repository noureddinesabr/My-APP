# Xapp mobile app

Expo (SDK 58) + Expo Router app. Routes live in `src/app/`; everything else outside it.

- Install packages with `npx expo install <pkg>` (add `EXPO_OFFLINE=1` if api.expo.dev is unreachable).
- All user-facing text goes through i18next (`src/i18n/locales/{en,fr,ar}.ts`). `en.ts` defines the shape; `fr` and `ar` must match it.
- Arabic is right-to-left. Use `Text` from `@/components/text` (handles alignment), `marginStart`/`paddingEnd` style props, and `useLanguage().rtl` for direction-dependent icons. Don't hardcode `left`/`right`.
- Colors come from `useColors()` in `src/theme.ts`; don't hardcode hex values in screens.
- Before finishing: `npm run typecheck` and `npx expo export --platform web` must succeed.
