# Qassemiya POS

Phase 1 of an all-in-one retail management platform for Qassemiya: Auth/RBAC, Branches,
Products/Inventory, and an offline-capable POS. Later phases add Shopify sync,
finance/accounting, vendors/purchasing, HR/payroll, and ZATCA e-invoicing.

## Apps

- `apps/api` — NestJS + PostgreSQL + Prisma backend
- `apps/web` — React back-office/admin app (Vite)
- `apps/pos` — Electron + React offline-capable POS terminal app
- `packages/shared-types` — Zod schemas shared across all three (request/response contracts)

## Setup

```bash
pnpm install

# Postgres (requires Docker; see "No Docker?" below otherwise)
docker compose -f docker/docker-compose.yml up -d
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp apps/pos/.env.example apps/pos/.env

pnpm db:migrate
pnpm db:seed   # prints seeded login credentials (admin, cashiers, POS PINs)

pnpm dev       # runs api + web + pos together
```

- API: http://localhost:3000
- Web admin: http://localhost:5173 (or whatever Vite prints)
- POS: launches as an Electron window — pair it to the seeded branch on first run using the API URL above

### No Docker?

Any local PostgreSQL 16 works — just point `apps/api/.env`'s `DATABASE_URL` at it
with a `qassemiya_pos` database (matching `docker/docker-compose.yml`'s defaults),
then run the migrate/seed steps above.

## Notes

- Employees are the login identity for POS PIN access; creating an employee via
  the admin app auto-provisions a linked (non-interactive) user account and role
  grants scoped to that employee's branch.
- The POS app works fully offline: sales/returns write to a local SQLite database
  first and print immediately, then sync to the server in the background once
  connectivity returns. Syncing is idempotent — retries and duplicate pushes never
  double-apply a sale.
