# Smart Stock Alert — Frontend

Vaccine stock tracking and alerts for AKUH's EPI network (District → Union Council → Facility). Seven roles, from the Super Admin to the vaccinator, see stock status at a glance, move stock through requests and approvals, and record each day's use, on a phone and offline when needed.

**Production:** https://smart-stock-alert.vercel.app
**Backend:** https://smart-stock-alert-be.vercel.app (separate repo; the app reaches it through a same-site `/api/*` proxy in `vercel.json`)

## Stack

Vite 6 · React 18 · React Router 7 · TanStack Query 5 · Tailwind 3 · lucide-react · Recharts · Vitest. Installable PWA with web push and an offline queue (`vite-plugin-pwa`, `src/sw.js`).

## Getting started

```bash
npm install
npm run dev                  # http://localhost:5173 (the backend only accepts this port)
```

Create `.env.local` first with:

```
VITE_API_URL=https://smart-stock-alert-be.vercel.app
```

Optional: `VITE_GOOGLE_CLIENT_ID` shows the Google sign-in button. Never commit `.env*` files.

The dev server talks to the **production database**: anything you create is real. Test logins are in `docs/test-accounts.md` (local only; ask the team).

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on port 5173 |
| `npm run build` | Production build (catches broken imports) |
| `npm test` | Vitest unit tests (`src/lib/*.test.js`) |
| `npx vite preview --port 5173 --strictPort` | Serve the production build signed in (stop the dev server first) |

## Repository guide

| File | Read it for |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | Conventions, architecture, folder structure, API constraints. Start here before changing code. |
| [`HANDOFF.md`](HANDOFF.md) | Current state, how the tricky parts work (proxy, offline, push), open issues, gotchas, next steps. |
| [`BACKEND_REQUESTS.md`](BACKEND_REQUESTS.md) | What the frontend needs from the backend (currently nothing open). |
| [`PRODUCT.md`](PRODUCT.md) | Users, roles, product principles. |
| [`DESIGN.md`](DESIGN.md) | The design system ("The Ward Ledger"); `.impeccable/design.json` is its sidecar. |

`docs/` is gitignored and local only: test accounts, the phone test checklist, design mockups and screenshots.

## Deployment

Every push to `main` deploys to Vercel Production. `VITE_API_URL` is deliberately **unset** there, so API calls stay relative and go through the proxy. Rollback steps are in `HANDOFF.md`.
