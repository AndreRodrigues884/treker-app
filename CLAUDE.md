# Treker

Gym and swim tracking app for self-coached athletes. Expo (React Native) + TypeScript + Expo Router, with Supabase as the backend.

@AGENTS.md

## Project rules

- **Read `docs/plano-produto.md` before starting any feature.** It is the product plan and decides what goes into the app.
- **Never commit or push.** At the end of each task, show a summary of what changed and wait for review.
- **Business logic lives in `src/core`, with tests.** Calculations, validation and PR rules are pure TypeScript (no React or React Native). Screens only display data and call that logic.
- **Data and security rules live in Postgres** (RLS, functions), not only in the app. Everything the app checks must also be enforced in the database.
- **Workout dates are stored as the athlete's local date**, never derived from UTC.
- **Os ecrãs leem e escrevem só através dos repositórios locais; nunca chamam o Supabase diretamente para dados de treino.** Screens use `src/features/*/repository.ts` (SQLite on the phone, with the outbox) and `useLocalQuery` for reactive reads. Only account operations (sign-in, the profile download at sign-in, deleting the account) call Supabase. See [docs/offline.md](docs/offline.md).
- **Records and stats are derived data** (`personal_records`, `exercise_stats`): only the Postgres rebuild triggers write them; the app never does. The 1RM formula exists in both `src/core/records` and Postgres; change both together and keep `supabase/tests/fixtures/one-rep-max-cases.json` as the single source of test cases.
- **No secrets in the app code.** Only the public Supabase publishable key (`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`), via `EXPO_PUBLIC_` environment variables.
- **Code and comments in English.** UI strings live in the `en` and `pt` dictionaries in `src/core/i18n` and are read with `useI18n()` from `src/lib/i18n`; never hard-code user-facing text. Dev-only screens are the exception.
- **Before calling a task done, run `npm run lint`, `npm run typecheck` and `npm test`.**

## UI conventions

- Dark mode only in v1. Every color, font, size, spacing and radius comes from `src/theme`; no loose values in components.
- Build screens from `src/components` (`Screen`, `AppText`, `Button`, `Card`, `TextField`, `Chip`, `Badge`/`PrBadge`, `ProgressBar`, `Divider`, `OptionCard`, `Stepper`, `EmptyState`, `ListRow`). Review them in the dev-only catalog at `/dev/components`.
- Icons: Lucide only (`lucide-react-native`), rendered through `Icon`. Never emoji as icons.
- Fonts: Geist for text, Geist Mono (`AppText variant="numeric"`) for times, weights and reps.
- Numbers shown to the user go through `src/core/format` (weights, swim times in centiseconds, distances).
- Accessibility: role and label on every control, touch targets of at least 44 pt, text scales with the system font size.

## Navigation

- Route groups: `(auth)` (intro, email, code), `(onboarding)`, `(app)`; the root `Stack.Protected` guards in `src/features/auth/root-navigator.tsx` decide which is open. "Signed in" only counts once the profile has loaded, so (app) never mounts for a moment and unmounts again.
- Inside `(app)`: the main screens (Today, Calendar, Records, Profile) live in a side menu, `src/app/(app)/(drawer)/` (Drawer from `expo-router/drawer`, with `DrawerContent` and `MenuButton` from `src/features/navigation`). Other screens (`start` as a modal, `settings/*`, `dev/*`) are pushed on the `(app)` Stack.
- Main screens use `<Screen belowHeader floating={<StartWorkoutButton />}>`: the drawer header covers the top safe area, and the floating "+" opens `/start`.
- **A navigator's list of screens never changes at runtime.** Never register screens conditionally (or behind a profile value); show or hide content instead. Only the three root groups are opened and closed, by `Stack.Protected`.
- Tests render the real routes with `test-utils/render-app.tsx`, listed in file (alphabetical) order like on the phone. Reanimated needs the chained resolver in `test-utils/jest-resolver.js` and `setUpTests()` in `jest.setup.ts`.

## Folder structure

- `src/app/` — Expo Router routes only (every file is a screen; do not put tests or helpers here)
- `src/components/` — reusable UI components
- `src/features/` — code per area: `gym`, `swim`, `calendar`, `records`, `profile`
- `src/core/` — pure TypeScript logic (types, Zod schemas, calculations such as 1RM and PRs); no React/React Native imports
- `src/lib/` — clients and services (Supabase, storage, the local SQLite database in `src/lib/local-db`)
- `src/theme/` — design tokens: colors, fonts, typography, spacing, radii, sizes
- `supabase/` — migrations and SQL tests
- `docs/` — documentation

## Commands

```bash
npx expo start      # dev server (scan the QR code with Expo Go)
npm run lint        # ESLint + Prettier
npm run typecheck   # tsc --noEmit
npm test            # Jest (jest-expo + Testing Library)
npm run format      # format with Prettier
npm run db:start    # local Supabase (needs Docker Desktop)
npm run db:reset    # re-apply migrations + seed
npm run db:test     # pgTAP tests in supabase/tests
npm run db:types    # regenerate src/lib/supabase/database.types.ts
```

Sign-in, session, route protection, profile settings and account deletion: see [docs/auth.md](docs/auth.md). External links (privacy policy, contact) live only in `src/lib/links.ts`. Screen tests mock the Supabase client with `test-utils/supabase-mock.ts` and render the real routes with `test-utils/render-app.tsx`.

Local database changes (SQLite on the phone): change `src/lib/local-db/schema.ts` and add a new numbered migration in `src/lib/local-db/migrations.ts` (never edit a shipped one); `schema-types.ts` makes `npm run typecheck` fail if the local rows stop matching the server's. Jest runs the real local database on Node's SQLite (`test-utils/expo-sqlite-mock.ts`).

Database changes: read [docs/database.md](docs/database.md) first and follow its "Ao acrescentar uma tabela" checklist. After changing migrations, run `db:reset`, `db:test` and `db:types`.

Typed routes (`.expo/types`) are regenerated by `npx expo start`. After adding a route without the dev server running, run `npx expo customize tsconfig.json` before `npm run typecheck`.

The project is on Expo SDK 58. Expo Go only runs the SDK it was built for, so the phone needs the SDK 58 version of Expo Go.
