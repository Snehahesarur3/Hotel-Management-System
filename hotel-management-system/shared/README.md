# Shared seed data

`seed/*.json` is the **single canonical dataset** for the whole system.

| Consumer | How it uses the seed |
|---|---|
| Frontend mock mode | Imports the JSON at build time, materialises it into localStorage on first load, then CRUD operates on localStorage. |
| Backend | `MockDataInitializer` reads the same files from the classpath at startup into the in-memory repositories (Maven copies `shared/seed` into the jar). |

Rules for the files:

- **Stable string IDs** (`RM-101`, `GST-0001`, `BK-0001`, `PAY-0001`, ...). Every foreign key must resolve.
- **Relative dates**: date fields hold tokens resolved against the current local date by both loaders:
  `"T+3"` → today + 3 days (`yyyy-MM-dd`), `"T-2@14:30"` → today − 2 days at 14:30 (`yyyy-MM-ddTHH:mm:ss`).
  Today's check-ins/check-outs and room statuses therefore stay consistent whenever the app starts.
- **Derived values are not stored**: nights, totals, guest booking counts and dashboard KPIs are
  computed by the services from the underlying records. Room `status` *is* stored, because it is
  operational state changed by workflows (check-in, check-out, cleaning). The generator derives its
  initial value from reservations and housekeeping tasks.
- **Monetary values** are JSON numbers with at most 2 decimals (Java reads them as `BigDecimal`).
- **Generated, not hand-edited**: change `shared/scripts/generate-seed.mjs` and run `node shared/scripts/generate-seed.mjs`.
  The generator refuses to write a dataset that breaks referential integrity, double-books a room,
  or has room statuses that disagree with reservations. Bump `seedVersion` when the data changes.
- **Fictional data only**: no real people, contact details or ID numbers.
