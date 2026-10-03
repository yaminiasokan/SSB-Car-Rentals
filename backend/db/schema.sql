-- =====================================================================================
-- SSB CAR RENTALS — PostgreSQL schema
-- Requires PostgreSQL 13+ (gen_random_uuid() is built in). Safe to run repeatedly:
-- every statement is IF NOT EXISTS.   Apply with:  npm run db:init   (or psql -f schema.sql)
--
-- Conventions
--   • Every entity table has a UUID primary key `id` (the API exposes it as `_id`).
--   • Money is NUMERIC(12,2) in rupees. Timestamps are TIMESTAMPTZ.
--   • Business identifiers (SSB-2026-000123, RCP-…, TKT-…, DMG-…, AGR-…) are separate UNIQUE columns.
--   • Things other tables point at are real tables with foreign keys. Data that is only ever read/written
--     together with its parent (price line items, inspection photos, checklist, AI findings, ticket replies,
--     status history) is stored as JSONB on the parent row.
--   • Business lists that live in backend/config/constants.js (locations, fuel types, body types,
--     transmissions) are validated by the API, not by CHECK constraints, so adding a city needs no migration.
-- =====================================================================================

-- Atomic counters for the human-readable IDs above.
CREATE TABLE IF NOT EXISTS counters (
  name TEXT PRIMARY KEY,
  seq  INTEGER NOT NULL
);

-- ---------------------------------------------------------------- users
CREATE TABLE IF NOT EXISTS users (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                   TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  email                  TEXT NOT NULL UNIQUE,                    -- stored lower-case by the API
  phone                  TEXT NOT NULL CHECK (phone ~ '^[6-9][0-9]{9}$'),
  password_hash          TEXT NOT NULL,                           -- bcrypt
  role                   TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'staff', 'admin')),
  address                TEXT NOT NULL DEFAULT '' CHECK (char_length(address) <= 300),
  license_number         TEXT NOT NULL DEFAULT '',
  license_expiry         TIMESTAMPTZ,
  license_verified       BOOLEAN NOT NULL DEFAULT FALSE,
  reward_points          INTEGER NOT NULL DEFAULT 0 CHECK (reward_points >= 0),
  is_active              BOOLEAN NOT NULL DEFAULT TRUE,
  reset_password_token   TEXT,                                    -- sha-256 of the emailed token
  reset_password_expires TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS users_role_idx ON users (role);
CREATE INDEX IF NOT EXISTS users_reset_token_idx ON users (reset_password_token) WHERE reset_password_token IS NOT NULL;

-- ---------------------------------------------------------------- vehicles
CREATE TABLE IF NOT EXISTS vehicles (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  slug              TEXT NOT NULL UNIQUE,
  brand             TEXT NOT NULL,
  model             TEXT NOT NULL,
  variant           TEXT NOT NULL DEFAULT '',
  body_type         TEXT NOT NULL DEFAULT 'Hatchback',
  fuel              TEXT NOT NULL,
  fuel_display      TEXT,
  transmission      TEXT NOT NULL DEFAULT 'Manual',
  seats             INTEGER NOT NULL CHECK (seats BETWEEN 2 AND 12),
  price_per_day     NUMERIC(12,2) NOT NULL CHECK (price_per_day >= 0),
  price_per_hour    NUMERIC(12,2) NOT NULL CHECK (price_per_hour >= 0),
  security_deposit  NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (security_deposit >= 0), -- unused: no deposit is ever charged (see pricingService.computePrice)
  registration_year INTEGER CHECK (registration_year >= 2000),
  mileage           TEXT NOT NULL DEFAULT '',
  images            TEXT[] NOT NULL DEFAULT '{}',
  features          TEXT[] NOT NULL DEFAULT '{}',
  description       TEXT NOT NULL DEFAULT '',
  location          TEXT NOT NULL,
  availability      BOOLEAN NOT NULL DEFAULT TRUE,               -- admin on/off switch
  status            TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Maintenance', 'Retired')),
  rating            DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
  review_count      INTEGER NOT NULL DEFAULT 0 CHECK (review_count >= 0),
  booking_count     INTEGER NOT NULL DEFAULT 0 CHECK (booking_count >= 0),
  eco_score         INTEGER CHECK (eco_score BETWEEN 0 AND 100),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vehicles_status_idx ON vehicles (status);
CREATE INDEX IF NOT EXISTS vehicles_location_idx ON vehicles (location);

-- ---------------------------------------------------------------- bookings
CREATE TABLE IF NOT EXISTS bookings (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_ref               TEXT NOT NULL UNIQUE,                 -- SSB-2026-000123
  user_id                   UUID NOT NULL REFERENCES users (id),
  vehicle_id                UUID NOT NULL REFERENCES vehicles (id),
  pickup_location           TEXT NOT NULL,
  return_location           TEXT NOT NULL,
  pickup_at                 TIMESTAMPTZ NOT NULL,
  return_at                 TIMESTAMPTZ NOT NULL,
  services                  TEXT[] NOT NULL DEFAULT '{}',
  -- price snapshot taken at booking time
  pricing_lines             JSONB NOT NULL DEFAULT '[]',
  pricing_service_lines     JSONB NOT NULL DEFAULT '[]',
  pricing_base_amount       NUMERIC(12,2) NOT NULL DEFAULT 0,
  pricing_services_amount   NUMERIC(12,2) NOT NULL DEFAULT 0,
  pricing_discount          NUMERIC(12,2) NOT NULL DEFAULT 0,
  pricing_promo_code        TEXT,
  pricing_promo_label       TEXT,
  pricing_tax_rate          DOUBLE PRECISION NOT NULL DEFAULT 0,
  pricing_tax_amount        NUMERIC(12,2) NOT NULL DEFAULT 0,
  pricing_deposit           NUMERIC(12,2) NOT NULL DEFAULT 0,
  pricing_rental_total      NUMERIC(12,2) NOT NULL DEFAULT 0,     -- everything except the refundable deposit
  pricing_total             NUMERIC(12,2) NOT NULL DEFAULT 0,
  pricing_billing_days      INTEGER NOT NULL DEFAULT 0,
  pricing_max_km            INTEGER,                              -- fair-usage limit for this booking (300 km × billing days)
  -- customer details as entered on the booking form
  customer_name             TEXT NOT NULL DEFAULT '',
  customer_phone            TEXT NOT NULL DEFAULT '',
  customer_email            TEXT NOT NULL DEFAULT '',
  customer_license_number   TEXT NOT NULL DEFAULT '',
  customer_address          TEXT NOT NULL DEFAULT '',
  status                    TEXT NOT NULL DEFAULT 'Pending'
                            CHECK (status IN ('Pending', 'Confirmed', 'Active', 'Completed', 'Cancelled')),
  payment_status            TEXT NOT NULL DEFAULT 'Unpaid'
                            CHECK (payment_status IN ('Unpaid', 'Paid', 'Pay on Pickup', 'Refunded', 'Partially Refunded')),
  hold_expires_at           TIMESTAMPTZ,                          -- unpaid booking blocks the car until then
  cancellation_reason       TEXT,
  cancellation_cancelled_at TIMESTAMPTZ,
  cancellation_cancelled_by TEXT,
  cancellation_refund_percent NUMERIC(5,2),
  cancellation_refund_amount  NUMERIC(12,2),
  status_history            JSONB NOT NULL DEFAULT '[]',          -- [{status, at, by, note}]
  inspection_before         BOOLEAN NOT NULL DEFAULT FALSE,
  inspection_after          BOOLEAN NOT NULL DEFAULT FALSE,
  reminder_pickup_sent      BOOLEAN NOT NULL DEFAULT FALSE,
  reminder_return_sent      BOOLEAN NOT NULL DEFAULT FALSE,
  reviewed                  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (return_at > pickup_at)
);
CREATE INDEX IF NOT EXISTS bookings_user_idx ON bookings (user_id);
CREATE INDEX IF NOT EXISTS bookings_vehicle_dates_idx ON bookings (vehicle_id, pickup_at, return_at);
CREATE INDEX IF NOT EXISTS bookings_status_idx ON bookings (status);
CREATE INDEX IF NOT EXISTS bookings_created_idx ON bookings (created_at DESC);

-- ---------------------------------------------------------------- payments
CREATE TABLE IF NOT EXISTS payments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_no     TEXT UNIQUE,                                      -- NULL until the payment succeeds / is accepted
  booking_id     UUID NOT NULL REFERENCES bookings (id),
  user_id        UUID NOT NULL REFERENCES users (id),
  kind           TEXT NOT NULL DEFAULT 'booking' CHECK (kind IN ('booking', 'damage')),
  amount         NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  deposit_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  revenue_amount NUMERIC(12,2) NOT NULL DEFAULT 0,                 -- recognised revenue (excl. refundable deposit and refunds)
  method         TEXT NOT NULL CHECK (method IN ('UPI', 'Credit Card', 'Debit Card', 'Net Banking', 'Cash on Pickup')),
  status         TEXT NOT NULL DEFAULT 'Pending'
                 CHECK (status IN ('Pending', 'Success', 'Failed', 'Refunded', 'Partially Refunded')),
  transaction_ref TEXT,
  failure_reason TEXT,
  details        JSONB NOT NULL DEFAULT '{}',                      -- masked only: last4, brand, upiId, bank — never PAN/CVV
  refund_amount  NUMERIC(12,2) NOT NULL DEFAULT 0,
  simulated      BOOLEAN NOT NULL DEFAULT TRUE,
  screenshot_url TEXT,                                              -- customer-uploaded proof of payment (UPI/bank app screenshot)
  verification_status TEXT NOT NULL DEFAULT 'Not Required'
                 CHECK (verification_status IN ('Not Required', 'Pending Review', 'Verified', 'Rejected')),
  verified_by_id UUID REFERENCES users (id),
  verified_at    TIMESTAMPTZ,
  paid_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payments_booking_idx ON payments (booking_id);
CREATE INDEX IF NOT EXISTS payments_user_idx ON payments (user_id);
CREATE INDEX IF NOT EXISTS payments_status_paid_idx ON payments (status, paid_at);

-- ---------------------------------------------------------------- inspections (AI AutoInspect)
CREATE TABLE IF NOT EXISTS inspections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id      UUID NOT NULL REFERENCES bookings (id),
  vehicle_id      UUID NOT NULL REFERENCES vehicles (id),
  type            TEXT NOT NULL CHECK (type IN ('before', 'after')),
  performed_by_id UUID REFERENCES users (id),
  performer_role  TEXT,
  images          JSONB NOT NULL DEFAULT '[]',                     -- [{slot, url, note, uploadedAt}]
  checklist       JSONB NOT NULL DEFAULT '[]',                     -- [{group, item, status, note}]
  notes           TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (booking_id, type)
);

-- ---------------------------------------------------------------- damage reports
CREATE TABLE IF NOT EXISTS damage_reports (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_ref                  TEXT NOT NULL UNIQUE,                -- DMG-2026-00001
  booking_id                  UUID NOT NULL UNIQUE REFERENCES bookings (id),
  vehicle_id                  UUID NOT NULL REFERENCES vehicles (id),
  customer_id                 UUID NOT NULL REFERENCES users (id),
  before_inspection_id        UUID REFERENCES inspections (id),
  after_inspection_id         UUID REFERENCES inspections (id),
  damage_detected             BOOLEAN NOT NULL DEFAULT FALSE,
  damages                     JSONB NOT NULL DEFAULT '[]',         -- [{_id, type, location, slot, severity, confidence, estimatedRepairCost, region, decision, note}]
  engine                      JSONB,                               -- {name, version, mock, note}
  status                      TEXT NOT NULL DEFAULT 'Pending Review'
                              CHECK (status IN ('Pending Review', 'Confirmed', 'Rejected', 'Customer Disputed', 'Resolved')),
  admin_review_reviewed_by_id UUID REFERENCES users (id),
  admin_review_reviewed_at    TIMESTAMPTZ,
  admin_review_comments       TEXT,
  final_amount                NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (final_amount >= 0),
  customer_notified_at        TIMESTAMPTZ,
  dispute_message             TEXT,
  dispute_at                  TIMESTAMPTZ,
  dispute_admin_response      TEXT,
  resolution_by_id            UUID REFERENCES users (id),
  resolution_at               TIMESTAMPTZ,
  resolution_note             TEXT,
  resolution_outcome          TEXT,
  payment_id                  UUID REFERENCES payments (id),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS damage_reports_customer_idx ON damage_reports (customer_id);
CREATE INDEX IF NOT EXISTS damage_reports_status_idx ON damage_reports (status);

-- ---------------------------------------------------------------- reviews
CREATE TABLE IF NOT EXISTS reviews (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id                UUID NOT NULL UNIQUE REFERENCES bookings (id),   -- one review per rental
  vehicle_id                UUID NOT NULL REFERENCES vehicles (id),
  user_id                   UUID NOT NULL REFERENCES users (id),
  rating_overall            INTEGER NOT NULL CHECK (rating_overall BETWEEN 1 AND 5),
  rating_vehicle_condition  INTEGER NOT NULL CHECK (rating_vehicle_condition BETWEEN 1 AND 5),
  rating_cleanliness        INTEGER NOT NULL CHECK (rating_cleanliness BETWEEN 1 AND 5),
  rating_pickup_experience  INTEGER NOT NULL CHECK (rating_pickup_experience BETWEEN 1 AND 5),
  comment                   TEXT NOT NULL DEFAULT '' CHECK (char_length(comment) <= 1000),
  verified                  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reviews_vehicle_idx ON reviews (vehicle_id);

-- ---------------------------------------------------------------- wishlist (many-to-many)
CREATE TABLE IF NOT EXISTS wishlist_items (
  user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES vehicles (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, vehicle_id)
);

-- ---------------------------------------------------------------- rewards ledger (positive = earned, negative = redeemed / reversed)
CREATE TABLE IF NOT EXISTS rewards (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES users (id),
  type               TEXT NOT NULL CHECK (type IN ('earn', 'redeem', 'reversal')),
  points             INTEGER NOT NULL,
  description        TEXT,
  booking_id         UUID REFERENCES bookings (id),
  reward_key         TEXT,
  coupon_code        TEXT,
  coupon_used        BOOLEAN NOT NULL DEFAULT FALSE,
  coupon_used_on_id  UUID REFERENCES bookings (id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rewards_user_idx ON rewards (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS rewards_coupon_code_key ON rewards (coupon_code) WHERE coupon_code IS NOT NULL;

-- ---------------------------------------------------------------- notifications
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type       TEXT NOT NULL DEFAULT 'general'
             CHECK (type IN ('booking_confirmed', 'payment_success', 'pickup_reminder', 'return_reminder', 'booking_cancelled',
                             'inspection_completed', 'damage_report', 'admin_message', 'support', 'reward', 'general')),
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  link       TEXT,
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id, created_at DESC);

-- ---------------------------------------------------------------- support tickets
CREATE TABLE IF NOT EXISTS support_tickets (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_no      TEXT NOT NULL UNIQUE,                             -- TKT-2026-00001
  user_id        UUID NOT NULL REFERENCES users (id),
  booking_id     UUID REFERENCES bookings (id),
  subject        TEXT NOT NULL CHECK (char_length(subject) <= 140),
  category       TEXT NOT NULL DEFAULT 'General'
                 CHECK (category IN ('General', 'Booking', 'Payment', 'Vehicle', 'Damage', 'Emergency')),
  priority       TEXT NOT NULL DEFAULT 'Normal' CHECK (priority IN ('Low', 'Normal', 'High', 'Urgent')),
  message        TEXT NOT NULL CHECK (char_length(message) <= 2000),
  emergency_type TEXT CHECK (emergency_type IN ('Roadside assistance', 'Accident assistance', 'Towing', 'Customer support')),
  location       TEXT,
  status         TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'In Progress', 'Resolved', 'Closed')),
  replies        JSONB NOT NULL DEFAULT '[]',                      -- [{by, role, name, message, at}]
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_tickets_user_idx ON support_tickets (user_id);
CREATE INDEX IF NOT EXISTS support_tickets_status_idx ON support_tickets (status);

-- ---------------------------------------------------------------- rental agreements (snapshot at booking time)
CREATE TABLE IF NOT EXISTS rental_agreements (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_no        TEXT NOT NULL UNIQUE,                        -- AGR-2026-00001
  booking_id          UUID NOT NULL UNIQUE REFERENCES bookings (id),
  user_id             UUID NOT NULL REFERENCES users (id),
  snapshot            JSONB NOT NULL,
  terms               TEXT[] NOT NULL DEFAULT '{}',
  cancellation_policy TEXT[] NOT NULL DEFAULT '{}',
  acknowledged_at     TIMESTAMPTZ,
  acknowledged_by     TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
