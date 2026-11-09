# Smart Stock Alert — Frontend

Vaccine stock tracking and alerts for AKUH's EPI network (District → Union Council → Facility). Seven roles, from the Super Admin to the vaccinator, see stock status at a glance, move stock through requests and approvals, and record each day's use from a phone.

**Production:** https://smart-stock-alert.vercel.app
**Backend:** https://smart-stock-alert-be.vercel.app (separate repository)

## Stack

Vite 6 · React 18 · React Router 7 · TanStack Query 5 · Tailwind 3 · lucide-react · Recharts · Vitest. Installable PWA with web push (`vite-plugin-pwa`, `src/sw.js`).

## Getting started

Requires Node.js 18 or later.

```bash
npm install
npm run dev                  # http://localhost:5173
```

Create `.env.local` in the project root first, using the environment file provided separately. It sets `VITE_API_URL` (the backend) and `VITE_GOOGLE_CLIENT_ID` (optional; shows the Google sign-in button).

- The dev server must run on **port 5173**: the backend's CORS allowlist only accepts that origin.
- The dev server talks to the live backend and its database, so anything created while testing is real data.
- Never commit `.env*` files.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on port 5173 |
| `npm run build` | Production build into `dist/` |
| `npm test` | Vitest unit tests (`src/lib/*.test.js`) |
| `npx vite preview --port 5173 --strictPort` | Serve the production build locally (stop the dev server first) |

## Project structure

```
src/
  App.jsx          router and route guards (each URL prefix maps to its roles)
  main.jsx         React root, TanStack Query setup
  sw.js            service worker (offline shell, push notifications)
  context/         AuthContext: session, login/logout
  lib/             api.js (every API call), status.js (status colours/labels), formatting, reports, navigation
  hooks/           shared React hooks
  components/      ui/ (primitives), shared/ (composites), layout/ (shell), feature folders
  pages/           one folder per role, plus login/ and shared/
public/            icons and images
scripts/           check-offline-holdings.mjs (node self-check, not part of the build)
```

The design system (colours, typography, component rules) is documented in [`DESIGN.md`](DESIGN.md).

## Deployment

The app is hosted on Vercel; every push to `main` deploys to production.

- `vercel.json` proxies `/api/*` to the backend, so the session cookie is first-party. **Leave `VITE_API_URL` unset in Vercel Production**; API calls then stay relative and go through the proxy.
- Set `VITE_GOOGLE_CLIENT_ID` in Vercel if Google sign-in is used.
- To roll back, use Vercel's Instant Rollback to the previous deployment.

Users install the app on their phones from https://smart-stock-alert.vercel.app/install.
