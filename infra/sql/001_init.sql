CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  short_bio TEXT,
  cuisines TEXT[],
  price_tier SMALLINT CHECK (price_tier BETWEEN 1 AND 4),
  cover_image_url TEXT,
  gallery_urls TEXT[],
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'ZA',
  coordinates GEOGRAPHY(POINT, 4326),
  timezone TEXT NOT NULL DEFAULT 'Africa/Johannesburg',
  phone TEXT,
  email TEXT,
  website_url TEXT,
  instagram_handle TEXT,
  opening_hours JSONB,
  amenities TEXT[],
  avg_rating NUMERIC(3,2) DEFAULT 0,
  review_count INT DEFAULT 0,
  deposit_policy JSONB,
  cancellation_policy JSONB,
  auto_confirm_rules JSONB,
  advance_booking_days INT DEFAULT 60,
  stripe_account_id TEXT,
  subscription_tier TEXT DEFAULT 'starter'
    CHECK (subscription_tier IN ('starter','pro','growth','enterprise')),
  subscription_status TEXT DEFAULT 'active',
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  onboarding_complete BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE restaurant_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order SMALLINT DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  section_id UUID REFERENCES restaurant_sections(id),
  label TEXT NOT NULL,
  capacity SMALLINT NOT NULL,
  min_covers SMALLINT DEFAULT 1,
  x_pos FLOAT,
  y_pos FLOAT,
  width FLOAT DEFAULT 60,
  height FLOAT DEFAULT 60,
  shape TEXT DEFAULT 'round' CHECK (shape IN ('round','square','rectangle')),
  features TEXT[],
  is_combinable BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  sort_order SMALLINT DEFAULT 0
);

CREATE TABLE time_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  slot_date DATE NOT NULL,
  slot_time TIME NOT NULL,
  duration_mins SMALLINT DEFAULT 120,
  total_seats SMALLINT NOT NULL,
  reserved_seats SMALLINT DEFAULT 0,
  max_arrivals SMALLINT,
  is_blocked BOOLEAN DEFAULT false,
  block_reason TEXT,
  blocked_by UUID,
  UNIQUE (restaurant_id, slot_date, slot_time),
  CONSTRAINT no_overbooking CHECK (reserved_seats <= total_seats)
);

CREATE TABLE guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  phone_verified BOOLEAN DEFAULT false,
  avatar_url TEXT,
  date_of_birth DATE,
  dietary_flags TEXT[],
  preferences JSONB,
  loyalty_points INT DEFAULT 0,
  loyalty_tier TEXT DEFAULT 'explorer'
    CHECK (loyalty_tier IN ('explorer','regular','vip','elite')),
  visit_count INT DEFAULT 0,
  total_spend NUMERIC(12,2) DEFAULT 0,
  is_vip BOOLEAN DEFAULT false,
  vip_note TEXT,
  referral_code TEXT UNIQUE DEFAULT encode(gen_random_bytes(6), 'hex'),
  referred_by UUID REFERENCES guests(id),
  stripe_customer_id TEXT,
  gdpr_consented BOOLEAN DEFAULT false,
  gdpr_consented_at TIMESTAMPTZ,
  marketing_opt_in BOOLEAN DEFAULT false,
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE staff_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  auth_user_id UUID UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'host' CHECK (role IN ('host','supervisor','manager')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  confirmation_code TEXT UNIQUE NOT NULL DEFAULT upper(encode(gen_random_bytes(4), 'hex')),
  guest_id UUID REFERENCES guests(id),
  restaurant_id UUID REFERENCES restaurants(id),
  slot_id UUID REFERENCES time_slots(id),
  table_ids UUID[],
  party_size SMALLINT NOT NULL CHECK (party_size BETWEEN 1 AND 20),
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','confirmed','waitlisted','seated','completed','cancelled','no_show','comped')),
  occasion TEXT,
  special_requests TEXT,
  dietary_notes TEXT[],
  high_chair_needed BOOLEAN DEFAULT false,
  is_vip_booking BOOLEAN DEFAULT false,
  preorder_items JSONB,
  preorder_subtotal NUMERIC(10,2),
  deposit_required BOOLEAN DEFAULT false,
  deposit_amount NUMERIC(10,2),
  deposit_currency TEXT DEFAULT 'ZAR',
  deposit_paid_at TIMESTAMPTZ,
  stripe_payment_intent TEXT,
  refund_amount NUMERIC(10,2),
  refunded_at TIMESTAMPTZ,
  refund_reason TEXT,
  promo_code TEXT,
  booking_source TEXT,
  referral_code_used TEXT,
  no_show_score FLOAT,
  high_risk_flagged BOOLEAN DEFAULT false,
  checked_in_at TIMESTAMPTZ,
  checked_in_by UUID,
  seated_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  estimated_end_time TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  cancelled_by_role TEXT,
  internal_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE reservation_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID REFERENCES reservations(id),
  actor_id UUID,
  actor_role TEXT,
  action TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT,
  metadata JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE waitlist_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id UUID REFERENCES guests(id),
  restaurant_id UUID REFERENCES restaurants(id),
  slot_id UUID REFERENCES time_slots(id),
  party_size SMALLINT NOT NULL,
  position INT NOT NULL,
  preferred_times TEXT[],
  status TEXT DEFAULT 'waiting'
    CHECK (status IN ('waiting','notified','claimed','expired','removed')),
  notified_at TIMESTAMPTZ,
  claim_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE loyalty_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id UUID REFERENCES guests(id),
  restaurant_id UUID REFERENCES restaurants(id),
  reservation_id UUID REFERENCES reservations(id),
  event_type TEXT NOT NULL,
  points_delta INT NOT NULL,
  balance_after INT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID UNIQUE REFERENCES reservations(id),
  guest_id UUID REFERENCES guests(id),
  restaurant_id UUID REFERENCES restaurants(id),
  overall_rating SMALLINT CHECK (overall_rating BETWEEN 1 AND 5),
  food_rating SMALLINT,
  service_rating SMALLINT,
  ambience_rating SMALLINT,
  comment TEXT,
  photo_urls TEXT[],
  dish_ratings JSONB,
  owner_response TEXT,
  responded_at TIMESTAMPTZ,
  sentiment_score FLOAT,
  key_themes TEXT[],
  is_published BOOLEAN DEFAULT false,
  is_flagged BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE staff_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID REFERENCES reservations(id),
  guest_id UUID REFERENCES guests(id),
  staff_id UUID REFERENCES staff_members(id),
  note_type TEXT DEFAULT 'general'
    CHECK (note_type IN ('general','allergy','vip','incident','handover')),
  content TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_restaurants_coords ON restaurants USING GIST (coordinates);
CREATE INDEX idx_restaurants_city ON restaurants (city, is_active);
CREATE INDEX idx_restaurants_slug ON restaurants (slug);
CREATE INDEX idx_timeslots_date ON time_slots (restaurant_id, slot_date);
CREATE INDEX idx_reservations_guest ON reservations (guest_id, created_at DESC);
CREATE INDEX idx_reservations_restaurant_date ON reservations (restaurant_id, created_at DESC);
CREATE INDEX idx_reservations_active ON reservations (status)
  WHERE status IN ('pending','confirmed','seated');
CREATE INDEX idx_reservations_confirmation ON reservations (confirmation_code);
CREATE INDEX idx_guests_email ON guests (email);
CREATE INDEX idx_reviews_restaurant ON reviews (restaurant_id, is_published);
CREATE INDEX idx_restaurants_name_trgm ON restaurants USING GIN (name gin_trgm_ops);
