# SSB CAR RENTALS — *Your journey, our wheels.*

A full-stack car-rental platform for **SSB CAR RENTALS** (Coimbatore & Tirupattur, 24x7):
React (Vite) frontend · Node/Express REST API · PostgreSQL (node-postgres).
Black + gold + white branding, a 7-step booking flow, customer & admin dashboards, and **AI AutoInspect** —
before/after vehicle photo comparison with a human-verified damage-report workflow.

> **Read "Assumptions" and "Verification status" below before going live.** Several things are
> deliberately simulated (payments, GPS, AI detection, e-mail) and some business values are placeholders.

---

## 1. Quick start

**Requirements:** Node.js 18+ and a PostgreSQL 13+ instance (local `postgres`, Docker, or a free hosted
instance from Neon / Supabase / Render).

```bash
# 1. Install
cd ssb-car-rentals
npm run install:all            # or: (cd backend && npm i) && (cd frontend && npm i)

# 2. Configure the backend
cp backend/.env.example backend/.env
#    -> edit DATABASE_URL (postgresql://user:password@host:5432/database) and set a long random JWT_SECRET

# 3. Create the database (once), then seed it (WIPES all tables, then loads the SSB fleet + demo data)
createdb ssb_car_rentals        # or create it in your hosted provider's dashboard
npm run seed                    # also applies backend/db/schema.sql automatically

# 4. Run (two terminals)
npm run dev:backend            # API      -> http://localhost:5000
npm run dev:frontend           # Website  -> http://localhost:5173
```

Open **http://localhost:5173**. Vite proxies `/api` and `/uploads` to the API, so no CORS setup is needed in development.

Already have a running database with real bookings and don't want to wipe it with `npm run seed`? Run
`npm --prefix backend run update-fleet` instead — it only (1) points every Ertiga listing at the 2025
Maruti Suzuki Ertiga photo and (2) zeroes out `security_deposit` on every vehicle. It never touches
bookings, payments, users or anything else, and is safe to run more than once.

Other commands: `npm test` (database-free logic tests) · `npm run build` (production frontend build; the API
then serves `frontend/dist` automatically when it exists) · `npm start` (production API) ·
`npm --prefix backend run db:init` (create/upgrade tables without seeding demo data).

### Demo logins (created by `npm run seed`)

| Role     | Email                           | Password       | Use it to…                                              |
|----------|---------------------------------|----------------|---------------------------------------------------------|
| Admin    | `admin@ssbcarrentals.demo`      | `Admin@123`    | `/admin` dashboard, vehicles, bookings, damage review   |
| Staff    | `staff@ssbcarrentals.demo`      | `Staff@123`    | Record inspections & run AI analysis (no admin panel)   |
| Customer | `customer@ssbcarrentals.demo`   | `Customer@123` | Bookings, active rental, wishlist, rewards, reports     |

Other seeded customers use the same customer password (`arun.kumar@…`, `priya.nair@…`, `meena.selvam@…`, `vignesh.s@…` `@ssbcarrentals.demo`).
Passwords come from `SEED_*_PASSWORD` in `.env` — **change them if you ever deploy seeded data.**
Promo codes: `SSB10`, `WELCOME500`, `LONGTRIP`. The demo customer also has reward coupon `SSBR-DEMO01` (free delivery & pickup).
Test payment failures: card ending `0000`, a UPI ID containing `fail`, or the bank “Test Bank (Fail)”.

---

## 2. Inventory (as specified)

**Coimbatore**

| Vehicle                     | Fuel          | ₹/day |
|------------------------------|---------------|------:|
| Innova Diesel                | Diesel        | 3,000 |
| Swift Diesel                 | Diesel        | 2,500 |
| Kia Petrol (7 Seater)        | Petrol        | 3,000 |
| Baleno Petrol                | Petrol        | 2,500 |
| Ertiga Petrol                | Petrol        | 3,000 |
| Innova Crysta Diesel         | Diesel        | 4,500 |
| Maruti Suzuki XL6 Petrol     | Petrol        | 3,000 |

**Tirupattur**

| Vehicle                     | Fuel          | ₹/day |
|------------------------------|---------------|------:|
| Swift Dzire                  | Petrol        | 2,000 |
| Baleno                       | Petrol        | 2,000 |
| Glanza                       | Petrol        | 2,000 |
| Tata Tiago                   | Petrol        | 2,000 |
| Hyundai Xcent                | Petrol        | 2,000 |
| Renault Triber                | Petrol        | 2,500 |
| Ertiga Petrol                | Petrol        | 2,500 |
| Ertiga Petrol + CNG          | Petrol + CNG  | 3,000 |

The two "Ertiga Petrol" listings are **separate vehicles** (own IDs, prices, bookings) — one per city. So are the
two "Baleno" listings. **Tata Altroz and Renault Duster cannot exist:** the `Vehicle` model rejects them
(`REMOVED_MODELS` in `backend/config/constants.js`), the seed never creates them, and `npm test` asserts it.
Every car has a maximum-usage limit of **300 km/day**, scaled by the number of rental days (`MAX_KM_PER_DAY` in
the same file); it's shown on car cards/details and the booking services step, and stored on each booking's
`pricing.maxKm`. Car photos are real Wikimedia Commons images of the matching model, hot-linked via the stable
`Special:FilePath` redirect — swap `images` on a vehicle if you'd rather host your own. Admins can add further
vehicles at `/admin/vehicles`.

### Optional services

- **Driver** — a flat trip charge shown as "Based on the trip (Minimum starting from ₹800)", not a per-day rate.
- **Child Seat** — unchanged: ₹150/day.
- **Delivery & Pickup** — distance-based: ₹500 flat for 10 km or below, +₹50 for every km beyond that (customer
  enters the one-way distance in the booking flow). There is no Navigation/GPS add-on — it was removed everywhere
  (UI, pricing, booking summary, checkout, backend) and cannot be booked or priced.

---

## 3. Guided tour / manual QA checklist

Everything below was designed to work end-to-end; please run through it once after setup (this mirrors your
"test before finalizing" list).

| # | Test | How |
|---|------|-----|
| 1 | Registration / login / logout / reset | `/register`, `/login`; `/forgot-password` shows a **demo reset link** (no e-mail provider is configured) |
| 2 | Car search & validation | Home → search box. Try return before pickup, or < 4 h → inline errors |
| 3 | Filtering & sorting | `/cars` → price, fuel, seats, transmission, location, type, availability, sort |
| 4 | Car details | Click a car: specs, features, eco score, reviews, rules, cancellation, deposit, insurance |
| 5 | Booking (7 steps) | *Book now* → dates → vehicle → services → price (try `SSB10`) → details → payment → confirmation (`SSB-2026-000123`-style ID) |
| 6 | Price calculation | Itemised: rental + services (driver flat ₹800, delivery ₹500/10 km +₹50/km, child seat, insurance) + GST − discount + refundable deposit = total; always computed server-side |
| 7 | Payment simulation | UPI / cards / net banking / cash on pickup — scan the **PAYMENT SCANNER**, choose a method, upload a payment screenshot (required for all but cash), then **PROCESS PAYMENT**; failure triggers above; receipt is printable; screenshot status shows **Pending Review** until staff verify it |
| 8 | Agreement | Confirmation page → accept → **Download agreement** (PDF) |
| 9 | Customer dashboard | `/dashboard` (demo customer has an **active rental**, upcoming, completed, wishlist, points, damage reports) |
| 10 | Rental tracking & emergency | `/track-rental` (simulated GPS) → *Emergency assistance* creates an urgent ticket |
| 11 | **AI AutoInspect** | Login as **staff/admin** → `/auto-inspect` → the active booking → *Before* tab → **Fill with demo photos** → Save → *After* tab → demo photos → Save → **Run AI analysis** (5-step loader) |
| 12 | Before/after + heatmap | The generated report shows side-by-side images with severity-coloured overlays |
| 13 | Human review | Admin: confirm/reject findings, edit severity/estimate, comment, set amount → customer is notified → customer **pays or disputes** → admin resolves |
| 14 | Reviews | Completed booking → *Review* (verified customers only, once per booking) |
| 15 | Wishlist, rewards, notifications | Heart icon; `/rewards` (5 pts / ₹100; redeem → coupon); bell icon |
| 16 | Support | `/support`: call/e-mail/ticket/FAQ, ticket replies |
| 17 | Admin | `/admin`: cards, vehicle CRUD + images, booking approve/cancel/status, damage reports, analytics (Recharts), customers, support |
| 18 | Responsive | Resize < 720 px: hamburger nav, tables become cards, filters become a drawer |

Seeded damage reports cover **every status** (Pending Review, Confirmed, Rejected, Customer Disputed, Resolved) so the admin
table and both sides of the workflow can be explored immediately.

---

## 4. AI AutoInspect — how it works, and what is real

```
AI detection → Damage report → Admin verification → Customer notification → Final decision → Payment / dispute
```

* Staff/customer upload **7 angles** (front, rear, left, right, interior, dashboard, wheels) + extras, notes, and the
  exterior/interior condition checklist. Customers may add *before* photos; **only staff/admin record *after* photos.**
* `POST /api/damage-detection/analyze` compares matching angles and creates a **DamageReport** (`Pending Review`).
* **The AI never charges anyone.** Customers cannot even see a report until an admin confirms it. Every AI screen is labelled
  *“AI-assisted detection — requires human verification.”*
* ⚠️ **The analyzer in this build is a mock**, not a trained model, and says so in the UI and in each report’s
  `engine` field. It is deterministic (seeded from the image bytes): identical photos → “no damage”; different photos → plausible
  placeholder findings with a bounding region for the overlay.
* **To plug in a real model:** replace the body of `analyzeDamage(beforeImage, afterImage)` in
  `backend/services/damageDetectionService.js` (e.g. call a Python/ONNX/cloud-vision service) and return the same JSON:

```js
{ damageDetected: true,
  damages: [{ type: "Scratch", location: "Front bumper", severity: "Moderate", confidence: 0.91,
              estimatedRepairCost: { min: 2000, max: 4000 },
              slot: "front", region: { x: 15, y: 68, w: 70, h: 16 } }] }   // slot+region (image %) drive the overlay
```

## 5. Other integration points

| Area | Status here | Where to replace |
|------|-------------|------------------|
| Payments | **Simulated gateway** + a real "PAYMENT SCANNER" (SSB's actual UPI QR / ID) — see below | `backend/services/paymentGateway.js` (Razorpay/Stripe/PayU) |
| GPS / map | **Simulated position** on a schematic SVG map | `backend/services/trackingService.js` (`getVehiclePosition`) and `frontend/src/components/MapView.jsx` |
| E-mail | Not configured; password-reset link is logged and returned in dev | `authController.forgotPassword` (nodemailer/SES) + booking/payment e-mails |
| Reminders | In-app notifications via a 15-min job | `backend/services/reminderService.js` (add SMS/WhatsApp/e-mail) |
| Logo / hero photo / payment QR | Built-in SVG logo & car illustration; real payment QR included | Drop `logo.png` / `hero.jpg` / `payment-qr.jpg` into `frontend/src/assets/` — picked up automatically |

### Payment scanner & screenshot verification

Checkout shows a **PAYMENT SCANNER** with SSB's real UPI QR (`frontend/src/assets/payment-qr.jpg`, UPI ID
`7305786562@ptaxis` — also in `COMPANY_UPI_ID`/`COMPANY.upiId`) and the exact amount to pay. The existing
simulated method tabs (UPI/Card/Net Banking/Cash) are unchanged and still drive the demo gateway outcome
(declines on "fail"/`0000`/Test Bank, as before). For every online method the customer must upload a screenshot
(JPG/JPEG/PNG, preview/change/remove supported) before **PROCESS PAYMENT** is enabled; on success it's stored via
`POST /api/payments/:id/screenshot` and shows "Payment screenshot uploaded successfully". Uploading a screenshot
never auto-verifies it — `payments.verification_status` starts at `Pending Review` and only moves to
`Verified`/`Rejected` through the staff-only `PATCH /api/payments/:id/verify` (money-movement `status` and the
verification status are separate columns, so the existing booking-confirmation flow is untouched). Cash on
Pickup keeps working exactly as before, with no screenshot required.

---

## 6. Security

JWT auth (7-day) · bcrypt (12 rounds) · role-based access (`customer` / `staff` / `admin`; roles can never be set by a client) ·
`express-validator` on inputs · parameterised SQL (no string-built queries) · Helmet · rate limiting (stricter on `/api/auth`) · image uploads restricted to
JPG/PNG/WebP, 5 MB, **magic-byte verified**, random filenames · centralised error handler (no stack traces in production) ·
generic “incorrect email or password” · reset tokens stored hashed, 30-min expiry · env-based secrets (`JWT_SECRET` is mandatory in production).
Trade-offs to be aware of: the JWT is kept in `localStorage` (simple, but XSS-sensitive — consider httpOnly cookies for production),
and there is no e-mail verification or 2FA.

---

## 7. API overview

`/api/auth` register · login · me · logout · forgot-password · reset-password/:token  
`/api/users` profile · password · *(admin)* list/get/activate/verify licence  
`/api/cars` list (filters/sort/date availability) · get · booked-slots · *(admin)* create/update/delete · images  
`/api/bookings` config · quote · create · mine · :id · cancel · track · agreement (get / acknowledge / **download PDF**)  
`/api/payments` pay · mine · :id · *(admin)* all · collect cash  
`/api/inspections` config · submit (multipart) · booking/:id · *(staff)* eligible bookings  
`/api/damage-detection` engine · analyze  
`/api/damage-reports` list · get · review · resolve · dispute · pay  
`/api/reviews` · `/api/wishlist` · `/api/rewards` (+redeem) · `/api/notifications` · `/api/support` (+emergency)  
`/api/admin` stats · bookings (+status/approve/cancel) · `/api/analytics`

**Models:** User, Vehicle, Booking, Payment, Inspection, DamageReport, Review, Wishlist, Reward, Notification, SupportTicket,
RentalAgreement (+ a small `Counter` for IDs like `SSB-2026-000123`, `RCP-…`, `DMG-…`).

## 8. Project structure

```
ssb-car-rentals/
├─ README.md · .env.example · package.json (helper scripts)
├─ backend/  server.js · app.js
│  ├─ config/ (env, db, constants, checklist)   ├─ models/ (11)      ├─ routes/ (15)
│  ├─ controllers/ (15)   ├─ middleware/ (auth, validate, upload, sanitize, error)
│  ├─ db/        pool.js (pg pool + tx helper) · schema.sql · migrate.js · model.js (data-mapper)
│  ├─ services/  pricing · availability · booking lifecycle · rewards · payment gateway · tracking ·
│  │             agreement (PDF) · reminders · notifications · damageDetectionService.js
│  ├─ utils/     seed.js · selfTest.js · sequence.js · placeholderImages.js
│  ├─ scripts/   update-fleet.js (non-destructive live-DB fixes — see Quick start)
│  └─ uploads/   inspections · vehicles · payments · seed (generated images)
└─ frontend/src/  components · pages (+admin) · layouts · services (API) · hooks · context · utils · assets
```

---

## 9. Assumptions & placeholders — please review

You supplied names, fuels and prices; everything else below is **my assumption**. All are easy to change (constants, seed, or the admin panel).

* **Fleet location split** (7 Coimbatore / 8 Tirupattur cars) follows your exact list — vehicles are matched to the *pickup* city. Edit in `/admin/vehicles`.
* **Transmission** (all Manual), **mileage**, **registration year**, **features** are placeholders — variant/trim names too. **No security deposit is charged, on any vehicle** — see `backend/services/pricingService.js`.
* **Hourly rate** ≈ 10 % of the day rate, capped at one day; **minimum rental 4 h**. **Fair usage: 300 km/day**, scaling with the number of rental days.
* **Optional services:** Driver — flat ₹800/trip ("Based on the trip (Minimum starting from ₹800)") · Child Seat ₹150/day · Insurance ₹400/day · Delivery & Pickup — ₹500 for ≤10 km, +₹50/extra km. There is no Navigation/GPS add-on.
* **Payment screenshot:** required for every online payment method before the booking can be processed; it is stored against the payment record but never auto-verifies it — a staff member must mark it Verified/Rejected. Cash on Pickup needs no screenshot.
* **Tax:** 12 % GST applied to rental + services − discount (not to the deposit). **Please confirm the correct GST treatment with your accountant.**
* **Cancellation:** >24 h 100 % refund · 6–24 h 50 % · <6 h none; deposit always refunded. Admin-initiated cancellations refund in full.
* **Unpaid bookings** hold the vehicle for 30 minutes. Date-overlap checks are done in application code; under very high concurrency two people could still race for the same slot (add a transactional lock if you scale).
* **Rewards:** 5 points per ₹100 of rental spend (deposit excluded), awarded on successful payment/cash collection and reversed on cancellation.
* **Rental terms / agreement text** are sensible samples, **not legal advice** — have them reviewed before commercial use.
* **Branding:** I could not see the poster/logo images (only the text brief came through), so the identity follows your description
  (black, metallic gold, white, premium). Drop your real logo into `frontend/src/assets/` to use it.

## 10. Verification status (honest)

This project was built in a sandbox **without network access, PostgreSQL or the ability to `npm install`**, so it has **not been run against a live database or in a browser**.
What *was* verified:

* ✅ `npm test` — 24 database-free checks pass: pricing (days/hours/caps/services/promos/tax, the delivery-by-km and flat-driver rules, 300 km/day fair usage, the ₹0 security deposit), removed-vehicle guard, the damage-service JSON contract and determinism.
* ✅ Every backend file passes `node --check`; all backend modules load and all route registrations reference existing handlers.
* ✅ The whole frontend compiles (esbuild bundle of every page/component, including lazy admin pages) and a type-checker pass found **no undefined identifiers** in either codebase.
* ⚠️ **Not yet exercised:** live PostgreSQL queries, actual HTTP requests, real browser rendering/CSS at each breakpoint, file uploads, PDF output. Expect to fix a few small runtime issues on first run — the QA checklist above is the fastest way to find them.

## 11. Troubleshooting

* **`ECONNREFUSED` / “cannot reach the server”** — start the API (`npm run dev:backend`) and check `DATABASE_URL` and that PostgreSQL is running.
* **Empty site / no cars** — run `npm run seed`.
* **Images 404** — the API serves `/uploads`; in production set `VITE_API_URL` / `VITE_ASSET_URL` if the API is on another origin (see `frontend/.env.example`).
* **Seed refuses to run** — it won't wipe a database when `NODE_ENV=production` unless you pass `--force`.

© 2026 SSB Car Rentals. All Rights Reserved.
