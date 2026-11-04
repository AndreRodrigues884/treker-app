# Treker

Gym and swim tracking app for self-coached athletes, built with Expo (SDK 58), TypeScript and Expo Router. The product plan is in [docs/plano-produto.md](docs/plano-produto.md).

## Requirements

- Node.js 22 or 24 (LTS)
- [Expo Go](https://expo.dev/go) on your phone (SDK 58)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/), only for the local database

## Install

```bash
npm install
```

## Run

```bash
npx expo start
```

Scan the QR code with the camera (iOS) or the Expo Go app (Android). Your phone and computer must be on the same network; if they can't reach each other, use `npx expo start --tunnel`.

## Test and check

```bash
npm run lint       # ESLint + Prettier
npm run typecheck  # TypeScript
npm test           # Jest
```

## Local database

```bash
npm run db:start   # start Supabase locally (first run downloads Docker images)
npm run db:test    # pgTAP tests
npm run db:stop
```

See [docs/database.md](docs/database.md) for the tables and security rules.
