# CGuard Pro — SuperAdmin Panel · Build Contract

This is the single source of truth for the build agents. The **foundation is
already built** (config, providers, router, api client, auth, layout, shared
UI, typed services). Your job: fill specific, pre-stubbed files. **Do not edit
shared/foundation files** unless your task says so.

---

## 0. Verified facts (DO NOT re-investigate — these were confirmed against the code)

### Backend = `/Users/mike/cguard-pro/backend` (Node + TS + Express + Sequelize)
- Routes mount under `/api`. The superadmin router is mounted at `/api/superadmin`
  via `src/api/superadmin/index.ts` (already wired into `src/api/index.ts`).
- Global `authMiddleware` sets `req.currentUser`. The superadmin router applies
  `requireSuperadmin` (already written) so **every handler can assume the caller
  is an authenticated superadmin.**
- `req.database` = the Sequelize models bag. Models are keyed by their define
  name (lowercase): `req.database.tenant`, `.tenantUser`, `.securityGuard`,
  `.user`, `.invoice`, `.clientAccount`, `.businessInfo`, `.billing`,
  `.superAdminAuditLog`, and `req.database.Sequelize.Op` for operators.

### Route module convention (MUST follow)
```ts
// src/api/superadmin/<domain>.ts
import ApiResponseHandler from '../apiResponseHandler';
import { db, listParams, writeAudit } from '../../services/superadmin/superadminHelpers';

export default (router) => {
  router.get('/<path>', async (req, res) => {
    try {
      const payload = await someService(req);
      await ApiResponseHandler.success(req, res, payload); // sends payload DIRECTLY
    } catch (error) {
      await ApiResponseHandler.error(req, res, error);
    }
  });
};
```
- **Return the payload object DIRECTLY** (no `{ success, data }` wrapper). The
  frontend `api.ts` reads `response.data` as the payload.
- Put business logic in `src/services/superadmin/<domain>Service.ts`; keep route
  files thin. Use `req.database` off the request (cross-tenant: NO tenant filter).
- For every **mutation** (create/update/suspend/reactivate/delete/status change),
  call `await writeAudit(req, { action, targetType, targetId, tenantId, statusCode, details })`.

### `tenant` model fields (these exist; there is **NO** `status` or `domain` column)
`id`(UUID), `name`, `url`, `plan`(`free|growth|enterprise`), `planStatus`
(`active|cancel_at_period_end|error`), `planStripeCustomerId`, `planUserId`,
`trialEndsAt`, `billingStatus`(`trialing|active|past_due|trial_expired|canceled`),
`stripeSubscriptionId`, `stripeSeatItemId`, `implementationPaidAt`,
`trialReminderStage`, **`suspendedAt`**(DATE null), **`suspensionReason`**(STRING null),
`address`, `addressLine2`, `postalCode`, `city`, `country`, `latitude`, `longitude`,
`phone`, `landline`, `email`, `logoId`, `taxNumber`, `businessTitle`, `extraLines`,
`website`, `licenseNumber`, `timezone`, `createdAt`, `updatedAt`, `deletedAt` (paranoid).
- **Required-on-create** (NOT NULL, no default): `name`, `address`, `phone`,
  `email`, `taxNumber`, `businessTitle`. (`beforeCreate` sets trialEndsAt/billingStatus.)
- **Derived lifecycle status** for display: `deletedAt` → `deleted`; else
  `suspendedAt` → `suspended`; else use `billingStatus`.

### Billable users & billing engine (already implemented — REUSE, don't reinvent)
- **One billable seat = one `tenantUser` row.** Count: `db.tenantUser.count({ where: { tenantId } })`.
  Helper exists: `import { countBillableSeats } from '../../services/subscriptionService'`.
- `tenantUser` fields: `id`, `userId`, `tenantId`, `roles`(string[]), `status`
  (`active|invited|pending|archived`), timestamps, paranoid. Associations: `belongsTo user`, `belongsTo tenant`.
- `securityGuard` fields incl: `id`, `tenantId`, `fullName`, `governmentId`,
  `guardType`, `isOnDuty`, paranoid.
- Pricing math: `import { quote, grossPerUserCents, platformFeeCents, feePct } from '../../lib/billingModel'`
  and `import { getSummary, trialInfo } from '../../services/subscriptionService'`.
  - `quote(seats, includeImplementation)` → `{ seats, perUserCents, platformFeeCents,
    monthlyCents, implementationCents, firstChargeCents, currency, netMonthlyCents }`.
  - Default net is $5/user (500¢), grossed up for Stripe fees → `grossPerUserCents()` ≈ 515¢.
  - `getSummary(db, tenant)` → `BillingSummary` (status, trial, seats, implementationPaid,
    hasSubscription, quote, trialDays). **MRR for a tenant** = its `quote(seats,false).monthlyCents`
    when `billingStatus === 'active'`, else 0. Sum across active tenants = platform MRR.
- `invoice` model (customer-facing invoices, per tenant): `id`, `tenantId`,
  `invoiceNumber`, `status`(e.g. `Borrador|Pendiente|Pagado|...`), `date`, `dueDate`,
  `items`(JSON), `payments`(JSON), `subtotal`, `total`, assoc `client`(clientAccount), `postSite`.

---

## 1. API CONTRACT (exact endpoints & response shapes)

All under `/api/superadmin`, all superadmin-gated. Shapes mirror
`superadmin/src/types/index.ts` — keep them identical.

### Dashboard — `src/api/superadmin/dashboard.ts` (agent: observability)
- `GET /dashboard` → `DashboardData`:
  `{ tenants:{total,active,trialing,pastDue,suspended,canceled,newThisMonth},
     users:{total,guards,staff},
     billing:{mrrCents,arrCents,netMrrCents,payingTenants,trialingTenants,activeSeats},
     recentTenants: TenantRow[] (latest 5), recentAudit: AuditEntry[] (latest 8) }`

### Tenants — `src/api/superadmin/tenants.ts` (agent: tenants)
- `GET /tenants?search=&plan=&billingStatus=&page=&limit=` → `Paginated<TenantRow>`
  `TenantRow = { id,name,url,email,plan,planStatus,billingStatus,suspendedAt,seats,mrrCents,trialEndsAt,createdAt }`
  (seats = tenantUser count; mrrCents = active? quote(seats,false).monthlyCents : 0). search matches name/email/url.
- `GET /tenants/:id` → `TenantDetail` (TenantRow + phone,address,city,country,timezone,
  taxNumber,businessTitle,website,stripeCustomerId(=planStripeCustomerId),stripeSubscriptionId,
  implementationPaidAt,suspensionReason, `counts`:Record<modelName,number> of tenant-scoped rows,
  `billing`: getSummary(db,tenant)). 404 if missing.
- `POST /tenants` body `{name,email,phone,address,taxNumber,businessTitle,plan?,timezone?,...}` → created `TenantDetail`. [audit `tenant.create`]
- `PUT /tenants/:id` body partial → updated `TenantDetail`. [audit `tenant.update`]
- `POST /tenants/:id/suspend` body `{reason}` → `{success:true}` (set suspendedAt=now, suspensionReason). [audit `tenant.suspend`]
- `POST /tenants/:id/reactivate` → `{success:true}` (suspendedAt=null, suspensionReason=null). [audit `tenant.reactivate`]
- `DELETE /tenants/:id?confirm=true` → `{success,recordsDeleted,tables}` (require confirm=true; soft-delete tenant via destroy; do NOT hard-cascade). [audit `tenant.delete`]
- `GET /tenants/:id/export` → `{tenant, tables:Record<name,rows>, exportedAt}` (tenant-scoped rows, cap 5000/table).

### Billing — `src/api/superadmin/billing.ts` (agent: billing)
- `GET /billing/overview` → `BillingOverview`
  `{mrrCents,arrCents(=mrr*12),netMrrCents,payingTenants(active),trialingTenants,
    pastDueTenants,activeSeats(sum seats of active),avgSeatsPerPayingTenant,
    perUserCents(=grossPerUserCents()),platformFeeCents(=platformFeeCents()),
    byStatus:{trialing,active,past_due,trial_expired,canceled}, mrrByPlan:[{plan,mrrCents,tenants}]}`
- `GET /billing/tenants?search=&billingStatus=&page=&limit=` → `Paginated<TenantBillingRow>`
  `{id,name,billingStatus,seats,monthlyCents,netMonthlyCents,hasSubscription,implementationPaid,trial:TrialInfo,stripeCustomerId,stripeSubscriptionId}`
- `GET /billing/tenants/:id` → `{tenant:{id,name,email}, summary:BillingSummary, invoices:InvoiceRow[]}`
- `GET /billing/invoices?search=&status=&tenantId=&page=&limit=` → `Paginated<InvoiceRow>`
  `InvoiceRow={id,tenantId,tenantName,invoiceNumber,status,date,dueDate,subtotal,total,clientName}` (join tenant.name + client.name)

### Users — `src/api/superadmin/users.ts` (agent: users)
- `GET /users?search=&tenantId=&role=&status=&page=&limit=` → `Paginated<UserRow>`
  `UserRow={id(tenantUser id),userId,fullName,email,tenantId,tenantName,roles:string[],status,createdAt}`
  (join user for fullName/email, tenant for name). search matches user email/name.
- `GET /users/:tenantUserId` → UserRow (+ optional assignments). 404 if missing.
- `POST /users/:tenantUserId/status` body `{status}` (active|archived) → `{success:true}`. [audit `user.setStatus`]
- `GET /guards?search=&tenantId=&page=&limit=` → `Paginated<GuardRow>`
  `GuardRow={id,fullName,governmentId,tenantId,tenantName,guardType,isOnDuty,createdAt}`

### Observability — `src/api/superadmin/observability.ts` + audit (agent: observability)
- `GET /observability/health` → `HealthReport`
  `{status,database:{connected,dialect,latencyMs},uptimeSeconds(process.uptime()),memory:{rss,heapUsed,heapTotal}(process.memoryUsage()),nodeVersion,timestamp}`
  (db latency: time a `SELECT 1` via `db(req).sequelize.query('SELECT 1')`).
- `GET /observability/stats` → `{tables: {name,count}[]}` — counts for the key models
  (tenant, tenantUser, securityGuard, user, clientAccount, businessInfo, incident, invoice). Keep it bounded.
- `GET /audit?action=&tenantId=&actorUserId=&page=&limit=` → `Paginated<AuditEntry>`
  ordered by createdAt DESC. `AuditEntry` shape per types file.

---

## 2. FRONTEND conventions (for page agents)

- **Path alias** `@/` → `src/`. **HeroUI**: import from `@heroui/react`
  (e.g. `import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Card, CardBody, CardHeader, Chip, Button, Input, Select, SelectItem, Modal,
  ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure, Pagination,
  Tabs, Tab, Spinner, Tooltip, Badge, Avatar, Skeleton, Progress } from "@heroui/react"`).
- **Icons**: `lucide-react`. **Charts**: `recharts`. **Toasts**: `import { toast } from "sonner"`.
- **Data fetching**: call the typed services in `@/services/*` (`tenantsService`,
  `billingService`, `usersService`, `observabilityService`, `dashboardService`).
  Do NOT call axios directly. Errors already toast automatically (except auth probes).
- **Shared UI** (reuse for consistency):
  `import { PageHeader } from "@/components/ui/PageHeader"`,
  `import { StatCard } from "@/components/ui/StatCard"`,
  `import { DataState } from "@/components/ui/DataState"`.
- **Formatting**: `import { usd, fmtDate, fmtDateTime, fmtRelative, compactNumber,
  statusColor, billingStatusLabel, fmtUptime, fmtBytes } from "@/lib/format"`.
  All money from the API is in **cents** → render with `usd(cents)`.
- **Page pattern**: a page is a default-export component. Use local `useState` +
  `useEffect` to load via a service, track `loading`/`error`, wrap content in
  `<DataState loading error empty onRetry>`. Use `PageHeader` at top. Use
  `Chip` with `color={statusColor(x)}` for statuses. Tables paginate via the
  HeroUI `Pagination` bound to the service's `page`/`totalPages`.
- **Navigation**: `useNavigate()` / `<Link>` from `react-router-dom`. Routes are
  already registered in `App.tsx` (don't touch it). Tenant rows link to
  `/tenants/:id`; billing rows to `/billing/tenants/:id`.
- Keep it **professional and dense** (enterprise admin aesthetic): cards with
  subtle borders, compact tables, clear empty/loading states, confirm modals for
  destructive actions (suspend/delete). Dark-mode first.

## 3. File ownership (fill ONLY your files; never edit foundation/shared)
- Foundation (DONE, do not edit): `vite.config.ts`, `tsconfig*.json`, `tailwind.config.js`,
  `postcss.config.js`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/styles/*`,
  `src/lib/*`, `src/types/*`, `src/services/*`, `src/contexts/*`,
  `src/components/ProtectedRoute.tsx`, `src/components/Layout.tsx`,
  `src/components/Sidebar.tsx`, `src/components/ui/*`.
- You may ADD new files under your own feature folder (e.g. a page's local
  components in `src/pages/tenants/components/`). Do not modify another agent's files.

## 4. Don't
- Don't run `npm install`/`npm run build` (no network in agent env; integration handles it).
- Don't touch the orphaned `backend/src/superadmin/` module (different, broken, unmounted).
- Don't add new dependencies (everything needed is already in package.json:
  @heroui/react, recharts, lucide-react, sonner, react-hook-form, zod, date-fns, axios).
