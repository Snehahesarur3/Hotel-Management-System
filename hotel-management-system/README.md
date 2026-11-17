# Hotel Management System

An enterprise-style hotel administration app: a **React + TypeScript** admin dashboard and a
**Spring Boot 3 / Java 21** REST API. Both parts run on **mock data** (no database) and are
built so the mock layer can later be replaced with MySQL/JPA.

```
hotel-management-system/
├── backend/    Spring Boot REST API (in-memory repositories)
├── frontend/   React + Vite admin dashboard (in-browser mock services or the API)
└── shared/
    └── seed/   Canonical mock dataset used by both sides (see shared/README.md)
```

> **Status:** all 15 development phases are complete (see [Development phases](#development-phases)). This is a demo-grade
> system: authentication is development-only, data lives in memory or the browser, and payments are simulated.
> See [Limitations](#limitations) before using it for anything real.

## What it does

| Module | What staff do there |
|---|---|
| Dashboard | Today's arrivals and departures, occupancy, revenue, booking sources and housekeeping status, all computed from live data |
| Rooms | Room inventory, tariffs, amenities and status, with each room's booking history |
| Reservations | Book with live availability and price quotes, edit, cancel; no double booking |
| Guests | Guest profiles with masked ID numbers and stay history |
| Check-in / Check-out | Arrivals, in-house guests and departures; ID check at check-in, final bill and settlement at check-out |
| Billing & Payments | Invoices (folios) with GST, extra charges, discounts, payments and refunds through a mock gateway |
| Housekeeping | Cleaning schedule, assignment and progress; checkout cleans are created automatically |
| Restaurant | Menu and orders charged to an in-house guest's bill |
| Staff | Employees, departments and employment status |
| Inventory | Stock levels, stock in/out with history, reorder alerts and suppliers |
| Reports & Analytics | Revenue, occupancy (ADR, RevPAR), reservation, guest and payment reports with CSV export |
| Settings | Hotel profile shown on invoices, GST rates, the role permissions and the demo data |

Five demo roles (Administrator, Manager, Receptionist, Housekeeping, Restaurant) each see only the modules and actions they may use.

## Quick start

Browser only, no backend needed:

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173, then sign in with a demo account listed on the sign-in page (e.g. admin / admin123)
```

With the Spring Boot API, see [Run the full stack](#run-the-full-stack-frontend-on-the-api).

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| JDK | 21+ | Code is compiled with `--release 21`, so newer JDKs work too. Set `JAVA_HOME`. |
| Maven | not required | Use the included wrapper (`mvnw` / `mvnw.cmd`). It downloads Maven 3.9.9 on first run. |
| Node.js | 20.19+ (tested on 24) | npm comes with it. |

## Run the backend

```bash
cd backend
./mvnw spring-boot:run          # Windows: mvnw.cmd spring-boot:run
```

| URL | What |
|---|---|
| http://localhost:8080/api/health | Public liveness check |
| http://localhost:8080/swagger-ui.html | OpenAPI / Swagger UI. Click **Authorize** and use a dev user. |
| http://localhost:8080/actuator/health | Actuator health |

At startup the API loads the canonical seed (`shared/seed`, copied onto the classpath by Maven) into memory, with relative
dates resolved against today in the hotel's time zone (`app.timezone`, default Asia/Kolkata). Data lives in memory only:
restarting the API restores the seed. CORS allows the Vite dev server on ports 5173 and 5174 (`app.cors.allowed-origins`).

Every endpoint the frontend's HTTP adapter calls (`frontend/src/api/http`) is implemented, with the same paths, query parameters,
JSON shapes and error messages as the mock services. The module sections below describe the rules; Swagger UI lists every endpoint.

For JSON (ECS) log output, run with `--spring.profiles.active=json-logs`.

Run the tests with `./mvnw test`.

## Run the frontend

```bash
cd frontend
npm install
npm run dev                      # http://localhost:5173
```

| Script | Purpose |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check and production build |
| `npm test` | Vitest + React Testing Library (`npm run test:watch` for watch mode) |
| `npm run lint` | oxlint |
| `npm run typecheck` | TypeScript only |

Tests use half the CPU cores (`maxWorkers: '50%'` in `vite.config.ts`): the page tests render the whole app in jsdom, and one
worker per core made timing-dependent tests flaky on laptops, especially on battery.

If port 5173 is busy, run `npm run dev -- --port 5174` (already allowed by the backend's CORS settings); for other ports add the origin
to `app.cors.allowed-origins` in `backend/src/main/resources/application.yml`.

### Run the full stack (frontend on the API)

1. Start the backend (see above) and wait for `Started HotelManagementApplication`.
2. Create `frontend/.env.local` (git-ignored) with `VITE_MOCK_API_ENABLED=false`, then run `npm run dev`.
3. Open the app and sign in with one of the demo accounts listed on the sign-in page (see [Security](#security-development-only)).

The top bar shows **Live API** and a green dot when the backend answers. Data then lives in the backend's memory: restarting it restores the seed.
Without step 2 the app runs entirely in the browser on the mock services; sign-in and role rules work the same way in both modes.

**Live API check.** With the backend running on a fresh start, `HMS_LIVE_API=http://localhost:8080/api npm test -- src/api/http/live.test.ts`
runs the frontend's HTTP adapter against it. It checks that each demo role is allowed or refused on every service method exactly as the
frontend's permission table says, that every read returns the same JSON structure as the mock services, that invalid input (empty forms,
bad values, mixed errors and business-rule conflicts, 37 cases) gets the same status, message and field errors from both, and a
create/update/cancel round trip. It is skipped in the normal test run.

---

## Architecture

### Backend: layered architecture (`com.hotel`)

| Package | Responsibility |
|---|---|
| `controller` | Thin REST controllers. They validate input and delegate to services. |
| `service` / `service.impl` | Service interfaces and the implementations that hold all business rules |
| `repository` | `BaseRepository<T>` abstraction (mirrors Spring Data `CrudRepository`) |
| `repository.inmemory` | Thread-safe `ConcurrentHashMap` implementations that return defensive copies |
| `entity` | Domain model (`Identifiable`, using string IDs shared with the frontend) |
| `dto` | Request and response records, one holder class per module (`RoomDtos`, `BillingDtos`, ...), matching `frontend/src/types` field for field |
| `calculation` | Pure calculations over a data snapshot: summaries, pricing and GST, folios (`BillCalculator`), dashboard, reports; and the room-status rules |
| `store` | `DataStore` (consistent snapshots, read/write lock for multi-step changes), `HotelData` snapshot, `HotelClock` |
| `seed` | `MockDataInitializer`: loads `shared/seed` at startup, resolving relative date tokens |
| `payment` | `PaymentGateway` contract and the clearly labelled `MockPaymentGateway` |
| `mapper` | Reserved. Entity-to-view mapping currently lives in `calculation.Summaries` and the services |
| `enums` | Every status and type (room, booking, payment, housekeeping, ...) |
| `exception` | `ApiException` with status and field messages: `ValidationException` (400), `PaymentDeclinedException` (402), `ResourceNotFoundException` (404), `BusinessRuleException` (409); `GlobalExceptionHandler` |
| `security` | Development authentication and role rules |
| `config` | CORS, OpenAPI, request-correlation logging |
| `util` | `MoneyUtils` (BigDecimal, 2 decimals, HALF_UP), `PageUtils`, `ListQueries` (search, filter, sort, page), `InputValidator`, `TextMatching`, `Formats` |

Error responses always have this shape:

```json
{ "timestamp": "...", "status": 409, "error": "Conflict", "message": "...", "path": "/api/...", "fieldErrors": { } }
```

**Same behaviour in both modes.** Services port the frontend mock services rule for rule, and `InputValidator` reports the first
broken rule per field with the frontend schemas' messages, so a form shows the same message whichever side answers.
`CalculationParityTest` asserts that the backend produces exactly the figures the frontend tests assert (dashboard KPIs, revenue,
folios, every report) from the same seed and date.

**Consistency.** Repositories are thread-safe per call. Operations that check rules and then write several records (a check-out writes the
stay, a payment, the room and a cleaning task) run inside `DataStore.write`, an exclusive lock, and check every rule before the first write,
so a rejected request changes nothing and two requests cannot double-book a room (covered by a concurrency test).

Every `/api` request gets an `X-Request-Id` header (generated, or passed through from the client). The id appears on each log line, and one summary line is logged per request.

**Switching to MySQL later:** add `spring-boot-starter-data-jpa` and a datasource, annotate the entities, and provide JPA-backed `BaseRepository` implementations. Services and controllers stay unchanged.

### Frontend: API adapter

```
components / pages ──► hooks (TanStack Query) ──► api (src/api/index.ts)
                                                     │
                         VITE_MOCK_API_ENABLED=true  │  false
                                 ┌───────────────────┴───────────────────┐
                                 ▼                                       ▼
                     mockServices (src/mock)                httpServices (src/api/http)
                     latency + localStorage                 Axios → Spring Boot API
```

- `src/api/types.ts` defines the `ServiceProvider` contract. Both implementations satisfy it.
- Components import only `api` from `@/api`. Changing the data source is a `.env` change, not a code change.
- Both adapters throw the same `ApiError` (status, message, fieldErrors), so error UI doesn't depend on the data source.
- Writes go through the `useApiMutation` hook. It invalidates the affected queries and reports the outcome in a toast.
- **Signed-in user.** `src/auth/session.ts` holds the session (sessionStorage, so it ends with the tab). The Axios client adds the
  session's `Authorization` header to every request; a 401 from the API ends the session and returns to the sign-in page with
  "Your session has ended". A 403 is shown like any other error ("You do not have permission to perform this action").
- **Same rules in mock mode.** `src/mock/services/accessControl.ts` wraps the mock services with the same per-method rules as the
  backend, so a role is refused (401/403, same messages) in both modes.

#### List endpoint conventions (both modes)

| Parameter | Meaning |
|---|---|
| `page`, `size` | Zero-based page, page size (default 20, max 200) |
| `search` | Case- and accent-insensitive free text; every word must match |
| `sort` | `field,asc` or `field,desc`; empty values always sort last |
| module filters | e.g. `floor=2&status=AVAILABLE&status=RESERVED` (repeat a key to pass several values) |

The response is a `PageResponse` with the fields `content`, `page`, `size`, `totalElements` and `totalPages`.

#### Rooms API and rules

| Method | Endpoint | Notes |
|---|---|---|
| GET | `/api/rooms` | Filters: `floor`, `type`, `status`; `search` covers number, type, status, amenities, description |
| GET | `/api/rooms/{id}` | 404 if unknown |
| GET | `/api/rooms/floors` | Distinct floors, used by the floor filter *(added beyond the original endpoint list)* |
| GET | `/api/rooms/{id}/activity` | Current stay, upcoming stays, history and housekeeping *(added)* |
| POST | `/api/rooms` | 201; 400 with field errors; 409 for a duplicate room number |
| PUT | `/api/rooms/{id}` | Same validation; status changes follow the rules below |
| PATCH | `/api/rooms/{id}/status` | `{ "status": "MAINTENANCE" }` *(added, for status management)* |
| DELETE | `/api/rooms/{id}` | 409 if the room has any history |

Business rules (validation schema in `frontend/src/schemas/room.ts`, mirrored by the backend's `RoomServiceImpl`):
- Room numbers have 3–4 digits, are unique, and start with the floor number (floor 2 → 201–299).
- **Occupied** and **Reserved** are set only by check-in and reservations. Staff can switch between Available, Cleaning
  and Maintenance. An Occupied room changes only at check-out; a Reserved room only when its booking changes.
  Setting **Available** on a room with an arrival today stores **Reserved**.
- Capacity can't drop below the party size of an active or upcoming booking. Price changes don't affect existing
  bookings, because the rate is fixed at booking time.
- Rooms with reservation, housekeeping or restaurant history can't be deleted, which keeps records intact. Set them to Maintenance instead.

#### Guests API and rules

| Method | Endpoint | Notes |
|---|---|---|
| GET | `/api/guests` | Filter `nationality`; `search` covers name, email, phone, guest ID, address. Each guest includes `previousBookingCount` and `lastStay` |
| GET | `/api/guests/{id}` | 404 if unknown |
| GET | `/api/guests/nationalities` | Values for the nationality filter *(added)* |
| GET | `/api/guests/{id}/history` | Stay statistics and every reservation *(added)* |
| POST | `/api/guests` | 201; `registrationDate` is set by the server; 409 for a duplicate email |
| PUT | `/api/guests/{id}` | Leave `idProofNumber` empty to keep the stored one |
| DELETE | `/api/guests/{id}` | 409 if the guest has reservations |

- **Identity numbers are never stored in full.** The API checks the format for each document type
  (for example, 12 digits for a National ID), then keeps only a masked form such as `XXXX-XXXX-9012`.
- Emails are unique, ignoring case. The previous-booking count, nights, spend and last stay are calculated from
  reservations and payments, not stored.

#### Reservations API and rules

| Method | Endpoint | Notes |
|---|---|---|
| GET | `/api/reservations` | Filters `status`, `source`, `from`, `to`; `search` covers booking ID, guest name, email, phone and room. The date range matches stays in the hotel at any point within it, including arrival and departure days |
| GET | `/api/reservations/{id}` | Booking with guest contact, room, GST quote and payments; 404 if unknown |
| GET | `/api/reservations/availability` | `checkIn`, `checkOut`, `guests`, optional `type` and `excludeReservationId` (used when editing). Returns bookable rooms with a quote *(added)* |
| POST | `/api/reservations` | 201; the nightly rate is locked in from the room's current price |
| PUT | `/api/reservations/{id}` | Pending or confirmed bookings only. Date changes keep the locked rate; moving rooms re-locks it |
| POST | `/api/reservations/{id}/cancel` | Pending or confirmed bookings only. The booking is kept with status Cancelled *(added; there is no DELETE)* |

- **No double bookings.** A room can't hold two pending, confirmed or checked-in bookings on the same night.
  Nights are half-open ranges, so a departure and an arrival on the same day don't clash. A clash returns 409 with
  the conflicting booking, e.g. `Room 104 is already booked 11 Nov – 13 Nov (BK-0027)`.
- **Bookability.** The party must fit the room's capacity. Rooms under Maintenance aren't offered. Check-in can't be in the past,
  except that an existing booking may keep its original date. Stays are 1–30 nights. New bookings start as Pending or Confirmed;
  check-in and check-out have their own workflow (Phase 7).
- **Charges.** Room charges are the nightly rate × nights. GST follows the slab for the nightly rate in `settings.json`:
  12% up to ₹7,500, 18% above. Restaurant and other extras are added to the final bill (Phase 8).
- **Room status follows bookings.** An Available room with a pending or confirmed arrival today becomes **Reserved**.
  If that arrival is cancelled, moved or re-dated, the room returns to Available. Occupied, Cleaning and Maintenance are
  left alone. The rooms and reservations services share this rule (`mock/rules/roomStatus.ts`).

#### Front desk API and rules (check-in / check-out)

| Method | Endpoint | Notes |
|---|---|---|
| GET | `/api/front-desk/overview` | Today's arrivals (late arrivals included), in-house guests and departures due or overdue *(added)* |
| GET | `/api/front-desk/check-in/{reservationId}` | ID document type on file (never the number) and the rooms that can be assigned, booked room first *(added)* |
| POST | `/api/front-desk/check-in/{reservationId}` | Body `{ roomId, idLast4 }`. 400 if the ID doesn't match; 409 if the room isn't ready |
| GET | `/api/front-desk/check-out/{reservationId}` | Final bill if the guest leaves today *(added)* |
| POST | `/api/front-desk/check-out/{reservationId}` | Body `{ paymentMethod? }`. Settles any balance, checks out, sends the room to housekeeping |

- **Check-in window.** Pending or confirmed bookings can be checked in from the arrival date until the day before departure.
  Late arrivals are allowed, and the booked nights are still charged.
- **Identity check without storing ID numbers.** Staff type the last 4 characters from the guest's physical document.
  The API compares them with the masked number on file and never sends the stored characters to the browser.
- **Room assignment.** The room must be ready: Available, or Reserved for this arrival. It must also fit the party and be
  free for the remaining nights. If the booked room is still being cleaned, the guest can be moved to another ready room
  at the booked rate. The room becomes Occupied.
- **Final bill.** Room (rate × nights) + room GST (slab by nightly rate) + restaurant orders (cancelled ones excluded)
  + 5% food GST, minus completed payments. Failed and refunded payments don't count.
  The departure date becomes the actual day of check-out, so early and late departures are billed for the nights used.
  A same-day stay is billed as one night. Every seeded checked-out stay reconciles to a zero balance under this formula, and a test checks it.
- **Check-out.** A balance due must be settled in the same request. The room then goes to **Cleaning**, and a
  checkout-clean task is assigned to the least busy active housekeeper. The task is High priority if someone arrives in that room today.

#### Billing API and rules

| Method | Endpoint | Notes |
|---|---|---|
| GET | `/api/billing/summary` | Outstanding balances, refunds due (credit), collected this month (net of refunds), pending payments *(added)* |
| GET | `/api/billing/invoices` | Filters `balance` (DUE, SETTLED, CREDIT) and `state` (ESTIMATE, INTERIM, FINAL, VOID); `search` covers invoice, booking, guest and room |
| GET | `/api/billing/invoices/{reservationId}` | Full invoice: hotel GSTIN, guest, lines, GST summary, payments |
| POST | `/api/billing/invoices/{reservationId}/adjustments` | Extra charge `{ kind: 'EXTRA', description, amount, gstPercent }` or discount `{ kind: 'DISCOUNT', description, amount | percent }` *(added)* |
| DELETE | `/api/billing/invoices/{reservationId}/adjustments/{id}` | While the folio is open *(added)* |
| POST | `/api/billing/invoices/{reservationId}/payments` | `{ amount, method }`; part-payments allowed, never more than the balance |
| POST | `/api/billing/invoices/{reservationId}/refund` | `{ method }`; refunds the whole credit balance *(added)* |
| GET | `/api/payments` | Payment history; filters `status`, `method`, `from`, `to`; `search` covers payment, invoice, guest, reference |
| PATCH | `/api/payments/{id}/status` | Confirm (`COMPLETED`) or fail (`FAILED`) a pending payment, e.g. a bank transfer *(added)* |

- **Invoices are derived, not stored.** Each booking has one folio, and `INV-0013` belongs to `BK-0013`.
  Its state follows the booking: Estimate before arrival, Interim while in-house, Final after check-out, and Void if cancelled.
  A cancelled booking has no charges, so any deposit becomes a refundable credit.
- **Extras and discounts** are stored in `billAdjustments` and can be changed while the folio is open; final invoices are locked.
  Each extra carries its own GST rate (0, 5, 12 or 18%). A discount is a fixed amount or a percentage of room charges,
  and a percentage follows the nights if the stay changes. Discounts reduce the taxable room value before GST and
  can never exceed the room charges. Check-out bills the same adjustments.
- **GST summary.** The invoice groups the taxable value by rate and splits the tax equally into CGST and SGST (intra-state supply).
- **Refunds** are stored as negative completed payments, so every revenue figure on the dashboard and in billing is net.
  Failed and refunded payments never count.
- **Older demo data keeps working.** Saved browser data from before this phase gains an empty `billAdjustments` list instead of being re-seeded,
  so local changes survive the upgrade.
- **Permissions.** Against the API, discounts, refunds and removing adjustments are for Manager and Admin. In the browser-only mock, every action is available.

#### Housekeeping API and rules

| Method | Endpoint | Notes |
|---|---|---|
| GET | `/api/housekeeping/tasks` | Filters `date`, `status`, `floor`, `staffId`, `taskType`, `priority`; `search` covers room, staff and notes. Default order is in progress, pending, done, then priority and room |
| GET | `/api/housekeeping/summary?date=` | Counts for the day, rooms in Cleaning, and workload per assignable staff member *(added)* |
| POST | `/api/housekeeping/tasks` | New tasks start as Pending |
| PUT | `/api/housekeeping/tasks/{id}` | Reassign, re-prioritise or reschedule; not for completed tasks |
| PATCH | `/api/housekeeping/tasks/{id}/status` | Pending → In progress → Completed; in progress can be paused back to Pending; completed is final *(added)* |
| DELETE | `/api/housekeeping/tasks/{id}` | Pending tasks only |

- **Assignment.** Only active Housekeeping or Maintenance staff can be assigned. A room can't have two open tasks of the same type on the same day.
- **Rooms follow the cleaning.** Check-out puts a room into Cleaning and creates a checkout-clean task (Phase 7).
  Completing the room's last open checkout or deep clean makes it **Available**, or **Reserved** if a guest arrives today.
  Rooms under Maintenance are never freed by a clean. The shared rule lives in `mock/rules/roomStatus.ts`.

#### Restaurant API and rules

| Method | Endpoint | Notes |
|---|---|---|
| GET | `/api/restaurant/summary` | Open orders, orders and sales today, menu availability *(added)* |
| GET | `/api/restaurant/menu` | Filters `category`, `vegetarian`, `available`; each dish includes `timesOrdered` |
| POST / PUT | `/api/restaurant/menu`, `/api/restaurant/menu/{id}` | Names are unique, ignoring case |
| PATCH | `/api/restaurant/menu/{id}/availability` | Take a dish on or off the menu *(added)* |
| DELETE | `/api/restaurant/menu/{id}` | Only dishes that never appeared on an order |
| GET | `/api/restaurant/orders` | Filters `status`, `date`; `search` covers order, guest, room and dish |
| POST | `/api/restaurant/orders` | `{ reservationId, items: [{ menuItemId, quantity }] }` |
| PATCH | `/api/restaurant/orders/{id}/status` | Placed → Preparing → Served (restaurant) or Delivered (room service); placed and preparing orders can be cancelled *(added)* |

- **Orders are charged to an in-house stay** and appear on its invoice with 5% food GST. Cancelled orders are excluded.
- **Prices are fixed when the order is placed.** Later menu price changes don't touch existing orders, and only available dishes can be ordered.
- **Orders on a checked-out stay are locked.** Its invoice is final, so they can no longer change.

#### Staff API and rules

| Method | Endpoint | Notes |
|---|---|---|
| GET | `/api/staff` | Filters `department`, `status`; `search` covers name, email, phone, ID, job title. Each record includes `openTasks` |
| GET | `/api/staff/summary` | Totals by employment status and department *(added)* |
| GET | `/api/staff/{id}` | 404 if unknown |
| POST / PUT | `/api/staff`, `/api/staff/{id}` | Work emails are unique (ignoring case); joining date at most 90 days ahead |
| DELETE | `/api/staff/{id}` | 409 if the person has any housekeeping task history |

- **Open work stays covered.** Someone with open housekeeping tasks can't be set to On leave or Inactive, or moved out of
  Housekeeping or Maintenance, until the tasks are reassigned.
- **History is kept.** Staff with task history can't be deleted; set them to Inactive instead.

#### Inventory API and rules

| Method | Endpoint | Notes |
|---|---|---|
| GET | `/api/inventory/items` | Filters `category`, `stock` (`LOW` includes out of stock, or `OUT`), `supplier`; each item includes `stockStatus`, `stockValue`, `shortfall` |
| GET | `/api/inventory/summary` | Totals, stock value and the reorder list, most urgent first *(added)* |
| GET | `/api/inventory/suppliers` | Suppliers derived from item records, with item and low-stock counts *(added)* |
| GET | `/api/inventory/items/{id}/movements` | Stock history, newest first *(added)* |
| POST | `/api/inventory/items` | `quantity` is the opening stock, recorded as the first movement |
| PUT | `/api/inventory/items/{id}` | Details only; quantity is never changed here |
| POST | `/api/inventory/items/{id}/stock-in` | `{ quantity, reason, unitCost? }`; updates the last-restocked date |
| POST | `/api/inventory/items/{id}/stock-out` | `{ quantity, reason }`; 409 if more than is on hand |
| DELETE | `/api/inventory/items/{id}` | Only items with no stock and no movement history |

- **Every quantity change is a recorded movement** (`STOCK_IN` / `STOCK_OUT`, matching the backend enum), with a reason and the balance after it.
  Movements are stored in `stockMovements`. Older saved demo data gains this list automatically, like `billAdjustments`.
- **Low** means at or below the reorder level; **out of stock** means zero.
  Stock-in suggests enough to reach twice the reorder level, so one receipt clears the alert.

#### Reports API and rules

Every report covers an inclusive date range, `?from=yyyy-MM-dd&to=yyyy-MM-dd`, of at most 731 days. Reports are read-only and are
recalculated from the current data on every request; in mock mode the rules live in `frontend/src/mock/calculations/reports.ts`.

| Method | Endpoint | Selects | Contents |
|---|---|---|---|
| GET | `/api/reports/revenue?groupBy=DAY|MONTH|YEAR` | Completed payments by payment date | Collected, refunds and net per period (empty periods included), by booking source and room type, plus folio charges of stays that checked out in the range. Daily grouping covers at most 93 days |
| GET | `/api/reports/occupancy` | Room nights in the range | Occupancy, room revenue, ADR and RevPAR overall, per night, per room type and per room |
| GET | `/api/reports/reservations` | Bookings by arrival (check-in) date | Counts by status and source, cancellation rate, average stay, lead time and party size, and the bookings themselves |
| GET | `/api/reports/guests` | Guests with a non-cancelled stay arriving in the range | New and returning guests, nationalities, and each guest's stays, nights and room revenue |
| GET | `/api/reports/payments` | Payments and refunds by payment date, any status | Totals by method and status, pending and failed amounts, and every transaction |

- **Cash vs billed.** Revenue figures are cash: completed payments, net of refunds, like the dashboard. The *Billed on departure* panel is the
  accrual view: room, food, extras, discounts and GST on the folios of stays that checked out in the range, paid or not.
- **Room nights.** A night belongs to its start date. Past nights count stays that happened (checked in or out). From tonight onwards, confirmed
  and pending bookings also count ("on the books") and the chart draws them dashed. A booking that never arrived is a no-show and never counts.
- **Room revenue, ADR, RevPAR.** Room revenue is the locked nightly rate of each night sold, before discounts and tax.
  ADR = room revenue ÷ room nights sold; RevPAR = room revenue ÷ room nights available (every room, every night of the range).
- **Returning guest** means an earlier stay that happened (checked in or out) arriving before the range; **new guest** means registered in the range.
- **Filters** are a quick range (last 7/30/90 days, this or last month, this year, next 30 days) or any custom dates, validated with the
  same schema as the service. The report, range and grouping live in the URL (`/reports?tab=occupancy&from=…&to=…`).
- **CSV export.** Each report table has an **Export** button that downloads exactly the rows shown, with raw numbers (no ₹ or separators),
  UTF-8 with a byte order mark for Excel. Text that a spreadsheet would run as a formula (starting with `=`, `+`, `-` or `@`) is prefixed with `'`.
- **Freshness.** Reports aggregate every module, so they are refetched whenever the page is opened rather than invalidated by each change.

#### Settings API and rules

| Method | Endpoint | Who | Purpose |
|---|---|---|---|
| GET | `/api/settings` | Admin, Manager | Hotel profile, check-in/check-out times, currency, time zone and GST rates |
| PUT | `/api/settings` | Admin | Update the hotel profile (name, address, phone, email, GSTIN) and check-in/check-out times |

- **Profile on invoices.** Invoices show the current profile, so a change applies to every invoice straight away.
- **Validation.** GSTIN is 15 characters (state code, PAN, entity number, `Z`, check character) and is stored uppercase without spaces.
  Times are 24-hour `HH:mm`, and check-out must be earlier than check-in so rooms can be cleaned between guests.
- **Taxes are read-only.** Bills are calculated from the GST rates, including invoices already issued, so editing a rate would silently
  change them. Rates are configuration (`shared/seed/settings.json`); supporting a rate change properly needs dated rates.
- **The Settings page** has four tabs: *Hotel profile* (editable by the administrator, read-only for managers), *Taxes*,
  *Users & roles* (the permission table by role, generated from `frontend/src/auth/permissions.ts`, plus the demo accounts) and
  *Data* (data source and its status, the hotel time zone with a warning if the API uses another one, and the demo-data reset in mock mode).

#### Payments: mock processing only

Payments go through `frontend/src/mock/payments/mockPaymentGateway.ts`, which is a stand-in and **not a payment gateway**.
Staff only choose a payment method. The mock approves it and returns a test reference: `MOCK-TXN-…` or `CASH-…` for payments, `MOCK-RFD-…` or `CASH-RFD-…` for refunds.
No card, UPI or bank details are collected, stored or sent, and the check-out screen says so.
A real provider belongs on the backend, behind the `PaymentGateway` interface (`backend/src/main/java/com/hotel/payment`), whose only implementation is the equally mock `MockPaymentGateway`.

List screens keep their search, filters, sort and page in the URL (`/rooms?floor=5&type=SUITE&sort=pricePerNight,desc&page=2`),
so views can be bookmarked and survive a refresh.

#### Mock mode internals (`frontend/src/mock`)

| File | Role |
|---|---|
| `seed.ts` | Builds the database from `shared/seed`, resolving relative dates |
| `storage.ts` | Saves to and loads from localStorage, with a schema and seed version. Unreadable or outdated data is re-seeded automatically. If storage is unavailable, the app keeps working in memory |
| `db.ts` | `getDatabase()` reads; `mutateDatabase()` applies a change **atomically**, so a failed business rule leaves nothing half-written. Changes made in other tabs are detected |
| `collection.ts` | Generic tools: search, filter, sort and paging (`applyListQuery`), CRUD with 404/409 errors, backend-style IDs (`nextId`) |
| `latency.ts` | `mockCall()`: simulated latency (`VITE_MOCK_LATENCY_MS`) and detached copies of results. Unexpected failures become 500 errors |
| `calculations/` | Pure business calculations: dashboard figures, folios, reports |
| `services/` | The mock implementation of the `ServiceProvider` contract |

The ↺ button next to "Mock data" in the top bar resets the demo data after a confirmation step. Payment processing in mock
mode is simulated. No payment gateway is called, and transaction references are prefixed `MOCK-TXN-`.

Frontend environment variables (`frontend/.env`; override in `.env.local`):

```
VITE_API_BASE_URL=http://localhost:8080/api
VITE_MOCK_API_ENABLED=true
VITE_MOCK_LATENCY_MS=300
VITE_HOTEL_TIMEZONE=Asia/Kolkata
```

`VITE_HOTEL_TIMEZONE` must match the backend's `app.timezone`. "Today" (arrivals, due-outs, the earliest bookable date, the top-bar date)
follows the hotel's calendar rather than the browser's, so staff in another time zone, or working around midnight, see the same day
as the API.

### Mock data integration strategy

There is **one dataset**, in `shared/seed`, loaded by both sides (details in [shared/README.md](shared/README.md)).

| Mode | Source of truth |
|---|---|
| `VITE_MOCK_API_ENABLED=true` | The browser's copy of the seed in localStorage. A "reset demo data" action re-seeds it. |
| `VITE_MOCK_API_ENABLED=false` | **The backend.** The frontend keeps no local data copy. The backend loads the same seed at startup. |

Seed dates are stored relative to the current date, so "today's check-ins" and room occupancy are realistic whenever the app runs.

The seed is generated by `node shared/scripts/generate-seed.mjs`. The script refuses to write data that would double-book
a room or break a reference.

### Dashboard definitions

Every figure is computed from the records. In mock mode that happens in `frontend/src/mock/calculations/dashboard.ts`; the backend implements the same rules in `calculation/DashboardCalculator`.

| Figure | Rule |
|---|---|
| Room counts | Rooms grouped by stored `status` |
| Occupancy rate | Occupied rooms ÷ total rooms |
| Today's check-ins | Reservations with check-in today and status Pending, Confirmed or Checked In |
| Today's check-outs | Reservations with check-out today and status Checked In or Checked Out |
| Revenue (total, weekly, monthly) | Sum of **completed** payments, by payment date |
| Occupancy trend | Rooms used each night (stays that were checked in or out) over the last 30 nights |
| Booking sources | Reservations per channel, excluding cancellations |
| Housekeeping | Tasks scheduled today, by status; open tasks listed high priority first |

Charts follow a validated colour order. Single-series charts use one hue, every chart has a **Table** view, and
entrance animations are skipped when the user prefers reduced motion.

---

## Testing

| Suite | Command | Covers |
|---|---|---|
| Backend | `cd backend && ./mvnw test` | JUnit 5, Mockito and MockMvc: calculations (with a parity test against the frontend's expected figures), every service's rules, JSON contracts, error responses, the role matrix, and a concurrency test for double booking |
| Frontend | `cd frontend && npm test` | Vitest and React Testing Library: mock services, calculations, schemas, utilities, every page's workflows, sign-in and role-based UI |
| Live API check | `HMS_LIVE_API=http://localhost:8080/api npm test -- src/api/http/live.test.ts` (backend running) | The frontend's HTTP adapter against the real API: access per role on every service method, response shapes and validation messages identical to the mock services, and a write round trip |
| Static checks | `npm run typecheck`, `npm run lint` | TypeScript and oxlint |

The live API check is skipped in the normal frontend run, so `npm test` never needs a backend.

## Security (development only)

> ⚠️ **This is not production authentication.** The API uses stateless HTTP Basic with fixed demo
> accounts defined in `application.yml`. Before any real deployment, replace it with a proper identity provider (OIDC/JWT).

| Username | Password | Role |
|---|---|---|
| admin | admin123 | ADMIN |
| manager | manager123 | MANAGER |
| reception | reception123 | RECEPTIONIST |
| housekeeping | housekeeping123 | HOUSEKEEPING |
| restaurant | restaurant123 | RESTAURANT |

`GET /api/auth/me` returns the authenticated user and their roles. All guest data in the seed is fictional.

Access rules are collected in `SecurityConfig.accessRules`. Unauthenticated calls get 401 and calls outside a role get 403, both with the usual error body.

| Module | Read | Write |
|---|---|---|
| Dashboard, rooms | Everyone | Rooms: Admin, Manager. Room status also Reception and Housekeeping |
| Guests | Admin, Manager, Reception | Same; delete: Admin, Manager |
| Reservations, front desk | Admin, Manager, Reception (front-desk overview also Restaurant, to find in-house guests) | Admin, Manager, Reception |
| Billing & payments | Admin, Manager, Reception | Refunds, removing adjustments and **discounts**: Admin, Manager |
| Housekeeping | Admin, Manager, Reception, Housekeeping | Admin, Manager, Housekeeping |
| Restaurant | Admin, Manager, Reception, Restaurant | Menu: Admin, Manager, Restaurant. Orders: also Reception |
| Staff | Admin, Manager | Admin, Manager |
| Inventory | Admin, Manager, Housekeeping, Restaurant | Stock in/out: same. Items: Admin, Manager |
| Reports | Admin, Manager | — |
| Settings | Admin, Manager | Hotel profile and check-in/out times: Admin |

The discount rule depends on the request body, so it is a `@PreAuthorize` on `BillingController#addAdjustment`.

### Sign-in in the frontend

Every page except `/sign-in` needs a signed-in user; visitors are sent to the sign-in page and back to the page they asked for.
The sign-in page lists the demo accounts above (labelled as development-only) so each role can be tried.

- **Against the API** the frontend checks the credentials with `GET /api/auth/me` (HTTP Basic) and keeps the Basic credentials
  in sessionStorage for the tab's lifetime. That is acceptable for fixed demo accounts only: a real deployment needs short-lived
  tokens from an identity provider, and `src/auth/devUsers.ts` must be removed.
- **In mock mode** the browser checks the same demo accounts itself and stores no credential.
- **What a role sees.** `src/auth/permissions.ts` is the frontend copy of the matrix above. It decides which modules appear in the
  sidebar, which pages open (others show "You don't have access to this page"), and which buttons appear: for example, reception sees
  **Add charge** but not **Add discount** on an invoice, and housekeeping sees only Dashboard, Rooms, Housekeeping and Inventory.
  Hiding is a convenience; the API (or the mock access rules) enforces every rule.
- Signing out, or a session ending, clears every cached response so the next user never sees data fetched for someone else.

---

## Limitations

What a production deployment would still need:

- **Authentication.** HTTP Basic with fixed demo accounts, and the browser keeps the credentials for the tab's lifetime. Replace with an
  identity provider (OIDC) and short-lived tokens, and remove `frontend/src/auth/devUsers.ts` and `app.security.dev-users`.
- **Storage.** Data is in memory (backend) or in the browser (mock mode); restarting resets it. The repositories are interfaces so a
  JPA/MySQL implementation can replace them; see *Switching to MySQL later* above.
- **Payments.** Simulated only. A real provider plugs in behind `PaymentGateway` on the backend; card or UPI details must never reach this app.
- **Tax rates** are fixed configuration (see Settings).
- **One hotel, one time zone, one currency (INR)**, English UI.
- **Personal data.** Guest ID numbers are masked when stored, and the seed is fictional; real guest data would need retention rules and access audits.

## Repository layout note

`../legacy/` contains the earlier JPA/H2 version of this project (`com.sneha.hotel`), kept unchanged for reference.
Its booking rules (date-overlap check, back-to-back stays allowed, cancelled bookings free the room)
are implemented in the mock reservation service (Phase 6) and in the Spring Boot `ReservationServiceImpl` (Phase 12).

## Development phases

| # | Phase | Status |
|---|---|---|
| 1 | Project setup & architecture | ✅ Done |
| 2 | Frontend layout & dashboard | ✅ Done (includes the canonical seed dataset from Phase 3) |
| 3 | Mock data architecture & API adapter | ✅ Done |
| 4 | Room management | ✅ Done |
| 5 | Guest management | ✅ Done |
| 6 | Reservation management | ✅ Done |
| 7 | Check-in / check-out | ✅ Done |
| 8 | Billing & payments | ✅ Done |
| 9 | Housekeeping & restaurant | ✅ Done |
| 10 | Staff & inventory | ✅ Done |
| 11 | Reports & analytics | ✅ Done |
| 12 | Spring Boot REST API | ✅ Done |
| 13 | Frontend–backend integration | ✅ Done |
| 14 | Testing, validation, bug fixing | ✅ Done |
| 15 | Documentation & polish (Settings, docs) | ✅ Done |
