# CGuard Pro — SuperAdmin Panel

Platform-level administration for the multi-tenant CGuard Pro SaaS: manage all
tenants, track subscription billing & invoicing ($5/user + Stripe fees, monthly),
browse cross-tenant users & guards, and monitor platform health. **Access is
restricted to platform superadmins.**

Stack: Vite 6 · React 18 · TypeScript · HeroUI (Tailwind v4) · Recharts · Axios.

---

## How it connects

- It talks to the **existing cguard backend** at `/api` (proxied; no separate API).
- Auth reuses the normal `POST /api/auth/sign-in`. That endpoint already returns
  `isSuperadmin: true` for platform admins. The panel **rejects any non-superadmin
  login** and re-verifies superadmin status against the backend on every reload.
- All panel data comes from new backend endpoints under **`/api/superadmin/*`**
  (added in `backend/src/api/superadmin/`), each gated by `requireSuperadmin`.

## Backend changes that ship with this (in the `backend` repo)

- `src/api/superadmin/` — new route modules (dashboard, tenants, billing, users,
  observability, audit), mounted in `src/api/index.ts`.
- `src/middlewares/superadminMiddleware.ts` — `requireSuperadmin` guard.
- `src/services/superadmin/` — service layer (cross-tenant queries; reuses the
  existing `billingModel`/`subscriptionService` pricing math).
- `src/database/models/superAdminAuditLog.ts` + migration
  `20260606-create-superadmin-audit-logs.ts` — audit trail of panel actions.
- `tenant` model gains `suspendedAt` + `suspensionReason` (migration
  `20260606-add-tenant-suspension-fields.ts`) for suspend/reactivate.

**Run the new migrations** (or just deploy — the post-deploy hook runs `migrate:all`):
```bash
cd backend
npx ts-node src/database/migrations/20260606-create-superadmin-audit-logs.ts
npx ts-node src/database/migrations/20260606-add-tenant-suspension-fields.ts
# or: npm run migrate:all   (idempotent; runs all migrations)
```

## Granting superadmin access

A user is treated as superadmin if **either**:
1. their `users.isSuperadmin` column is `true`, **or**
2. any of their tenant memberships has the `superadmin` role.

To grant via SQL (simplest):
```sql
UPDATE users SET "isSuperadmin" = true WHERE email = 'you@example.com';
```
Then sign in to the panel with that account.

## Local development

```bash
cd superadmin
cp .env.example .env          # defaults are fine if backend runs on :8080
npm install
npm run dev                   # http://localhost:5183/superadmin
```
`vite dev` proxies `/api` → `VITE_DEV_API_TARGET` (default `http://localhost:8080`).
Start the backend separately (`cd backend && npm run start:multi` or `dev:multi`).

## Production build & deploy (served at `app.cguardpro.com/superadmin`)

```bash
cd superadmin
npm ci
npm run build                 # → dist/ (assets are prefixed with /superadmin/)
```

Publish `dist/` to a `/superadmin` location served by nginx on the same origin as
the main app. Example nginx (add to the `app.cguardpro.com` server block):
```nginx
location /superadmin/ {
    alias /var/www/superadmin/;        # rsync dist/ here
    try_files $uri $uri/ /superadmin/index.html;   # SPA fallback
}
```
`/api/` is already proxied to the backend on that host, so no extra API config is
needed. The app's router `basename` and Vite `base` are both `/superadmin`.

## Modules

- **Dashboard** — MRR/ARR, tenant & seat counts, status mix, recent tenants & activity.
- **Tenants** — search/filter, detail (overview · billing · data counts), create,
  edit, suspend/reactivate (with reason), delete (confirmed), JSON export.
- **Billing** — platform MRR/ARR/net, per-tenant seats & $5/user math, subscription
  & trial state, Stripe linkage, and cross-tenant invoice history.
- **Users** — all staff (with roles/status, archive/reactivate) and guards across tenants.
- **Observability** — DB/health/uptime/memory, table footprint, and a full audit log.

See `CONTRACT.md` for the exact API contract and schema facts.
