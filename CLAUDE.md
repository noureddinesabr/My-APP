# Xapp

Freight delivery marketplace for Morocco (Arabic, French, English). Plan: `docs/PLAN.md`.

**Every feature must follow `docs/UX_PRINCIPLES.md`** (smart defaults, goal gradient, value before sign-up, pre-login ownership, loss aversion, price anchoring) **and its honesty guardrails.** Check new screens against it before finishing. Visual and interaction rules (colours, glass, bento, motion, haptics, sheets): `docs/DESIGN_SYSTEM.md`.

**Colour rule (owner, always, every app):** name a colour by its job (background, surface, primary, on-primary, error…), never by its look. All colours live in one theme file; screens use the named roles and never write a hex or rgb colour. In `apps/showit` this is checked automatically by `npm run typecheck` (`scripts/check-colors.js`).

- `apps/mobile`: Expo app (see `apps/mobile/CLAUDE.md`)
- `apps/showit`: separate "Show it, say it" test app (photo + voice note + AI card), its own APK (see `apps/showit/CLAUDE.md`)
- `apps/admin`: admin web panel (not started)
