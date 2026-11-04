# Treker

Gym and swim tracking app for self-coached athletes. Expo (React Native) + TypeScript + Expo Router, with Supabase as the backend.

@AGENTS.md

## Project rules

- **Read `docs/plano-produto.md` before starting any feature.** It is the product plan and decides what goes into the app.
- **Never commit or push.** At the end of each task, show a summary of what changed and wait for review.
- **Business logic lives in `src/core`, with tests.** Calculations, validation and PR rules are pure TypeScript (no React or React Native). Screens only display data and call that logic.
- **Data and security rules live in Postgres** (RLS, functions), not only in the app. Everything the app checks must also be enforced in the database.
- **Workout dates are stored as the athlete's local date**, never derived from UTC.
- **No secrets in the app code.** Only the public Supabase (anon) key, via `EXPO_PUBLIC_` environment variables.
- **Code and comments in English.** UI strings must be ready for English and Portuguese (no hard-coded user-facing text once i18n is in place).
- **Before calling a task done, run `npm run lint`, `npm run typecheck` and `npm test`.**

## Folder structure

- `src/app/` — Expo Router routes only (every file is a screen; do not put tests or helpers here)
- `src/components/` — reusable UI components
- `src/features/` — code per area: `gym`, `swim`, `calendar`, `records`, `profile`
- `src/core/` — pure TypeScript logic (types, Zod schemas, calculations such as 1RM and PRs); no React/React Native imports
- `src/lib/` — clients and services (Supabase, storage)
- `src/theme/` — colors, typography, spacing
- `supabase/` — migrations and SQL tests
- `docs/` — documentation

## Commands

```bash
npx expo start      # dev server (scan the QR code with Expo Go)
npm run lint        # ESLint + Prettier
npm run typecheck   # tsc --noEmit
npm test            # Jest (jest-expo + Testing Library)
npm run format      # format with Prettier
```

The project is on Expo SDK 58. Expo Go only runs the SDK it was built for, so the phone needs the SDK 58 version of Expo Go.
