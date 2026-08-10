# Drona Enterprises — Profitability Suite

A multi-tenant SaaS application for business financial & profitability management.
Built with Next.js 16, TypeScript, Prisma (SQLite), Tailwind CSS 4, and shadcn/ui.

## Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) 18+ (or [Bun](https://bun.sh/) recommended)
- SQLite (no separate server needed — the DB is a single file at `db/custom.db`)

### Install dependencies
```bash
bun install
# or
npm install
```

### Set up the database
The schema and seed data are already pushed to `db/custom.db` (included in this zip).
To re-create from scratch:
```bash
bun run db:push        # push Prisma schema
bun run prisma/seed.ts # seed sample data (parent + 2 tenants, 7 clients, 9 employees, allocations, expenses)
```

### Run the dev server
```bash
bun run dev
# or
npm run dev
```
The app will be available at `http://localhost:3000`.

## Demo Logins

| Role | Email | Password |
|---|---|---|
| Group Admin (sees all tenants) | group.admin@drona.com | admin123 |
| Company Admin (Drona Logitech) | logitech.admin@drona.com | admin123 |
| Company Admin (Drona Valuechain) | valuechain.admin@drona.com | admin123 |
| Standard User (Logitech, view-only) | user.logitech@drona.com | user123 |
| Standard User (Valuechain, view-only) | user.valuechain@drona.com | user123 |

## Modules

1. **Dashboard** — KPIs, charts (revenue/cost donuts, profit bar, trend line), per-client profitability table
2. **Companies** — Multi-tenant hierarchy (parent + tenants) + Custom Columns table (Group Admin only)
3. **Clients** — Master data with type, location, contract value
4. **Revenue** — Invoices and revenue entries
5. **Employees** — Workforce master data
6. **Allocations** — Employee→Client allocation % (drives cost allocation for profitability)
6. **Expenses** — Operational, administrative & capital expenses
7. **Reports** — Per-company profitability report with the calculation flow (Revenue − Cost = Profit → Margin)

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 16.1.3 |
| Language | TypeScript | 5 |
| Styling | Tailwind CSS | 4 |
| UI Components | shadcn/ui + Radix UI + lucide-react | — |
| Database ORM | Prisma (SQLite provider) | 6.19.2 |
| Charts | Recharts | 2.15.4 |
| Client State | Zustand | 5.0.6 |
| Auth | Custom cookie-session (12h TTL, httpOnly cookie) | — |
| Notifications | Sonner | 2.0.6 |
| Animations | Framer Motion | 12.23.2 |

## Architecture Highlights

- **Multi-tenant isolation** enforced at the backend. `getAccessibleCompanyIds(user)` returns either all company IDs (GROUP_ADMIN) or just the user's own companyId. Every API route filters Prisma queries with `where: { companyId: { in: accessibleIds } }`.
- **RBAC** with three roles: GROUP_ADMIN, COMPANY_ADMIN, STANDARD_USER. Sidebar nav and Add buttons are gated by role.
- **Profitability calculation**: gathers Revenue, EmployeeCost (allocated to clients via EmployeeClientAllocation %), and Expenses, then computes `Total Revenue − Total Cost = Profit → Profit Margin`. Real KPIs from the seeded data: ₹21.12 Cr revenue, ₹5.53 Cr cost, ₹15.59 Cr profit, 73.8% margin (consolidated view, Apr–Sep 2024).
- **Custom Columns** feature in the Companies module uses `useSyncExternalStore` + `localStorage` for live-persisting column preferences (8 toggleable columns).

## Files

- `prisma/schema.prisma` — 13 Prisma models (User, Session, Company, ClientType, Location, EmployeeType, Department, Client, Revenue, Employee, EmployeeCost, EmployeeClientAllocation, ExpenseCategory, Expense)
- `prisma/seed.ts` — Sample data seeder
- `src/lib/auth.ts` — Authentication + tenant isolation
- `src/lib/app-store.ts` — Zustand store
- `src/app/api/` — 18 API endpoints (auth, companies, clients, revenue, employees, employee-costs, allocations, expenses, dashboard, reports, + reference data)
- `src/components/drona/` — LoginScreen, AppShell, DronaApp entry
- `src/components/drona/modules/` — 8 module components (Dashboard, Companies, Clients, Revenue, Employees, Allocations, Expenses, Reports)

## Documentation
A detailed technical report is available at `download/Drona_Profitability_Suite_Technical_Report.pdf` (25 pages, covering architecture, working, tech stack, API reference, data model, and security).

## Notes
- This is a demo-grade implementation. The password hashing is intentionally simple (reversed string with prefix). For production, use bcrypt/argon2.
- The `Employee Cost` UI module was removed in iteration 2, but the underlying Prisma model + `/api/employee-costs` route are retained because the Dashboard aggregates employee costs into Total Cost.
- The SQLite DB file (`db/custom.db`) is included with the seeded data already loaded — you can start exploring immediately after `bun install` + `bun run dev`.
