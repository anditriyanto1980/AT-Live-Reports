-- ==========================================================
-- SRA LIVE STREAM ANALYTICS
-- SUPABASE POSTGRESQL SCHEMA & ROW LEVEL SECURITY
-- ==========================================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------
-- 1. TABLE: users
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'manager', 'operator')),
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ----------------------------------------------------------
-- 2. TABLE: streamers
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS streamers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  username VARCHAR(255) UNIQUE NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ----------------------------------------------------------
-- 3. TABLE: live_reports
-- HARD REQUIREMENT: No image_url, image_path, or screenshot storage!
-- Only structured metric data is stored.
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS live_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_date DATE NOT NULL,
  streamer_id UUID NOT NULL REFERENCES streamers(id) ON DELETE CASCADE,
  order_status VARCHAR(100) DEFAULT 'Pesanan Dibuat',
  sales BIGINT NOT NULL DEFAULT 0,
  active_viewers INTEGER NOT NULL DEFAULT 0,
  comments INTEGER NOT NULL DEFAULT 0,
  add_to_cart INTEGER NOT NULL DEFAULT 0,
  views INTEGER NOT NULL DEFAULT 0,
  avg_watch_duration VARCHAR(20) NOT NULL DEFAULT '00:00:00',
  comment_rate NUMERIC(6, 2) NOT NULL DEFAULT 0.0,
  sales_per_mille BIGINT NOT NULL DEFAULT 0,
  orders INTEGER NOT NULL DEFAULT 0,
  sales_per_order BIGINT NOT NULL DEFAULT 0,
  viewers INTEGER NOT NULL DEFAULT 0,
  peak_viewers INTEGER NOT NULL DEFAULT 0,
  click_rate NUMERIC(6, 2) NOT NULL DEFAULT 0.0,
  order_click_rate NUMERIC(6, 2) NOT NULL DEFAULT 0.0,
  buyers INTEGER NOT NULL DEFAULT 0,
  products_sold INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

  -- Unique constraint: Mencegah laporan streamer yang sama pada tanggal yang sama tersimpan 2x
  CONSTRAINT uq_report_date_streamer UNIQUE (report_date, streamer_id)
);

-- Index for high-performance dashboard analytics queries
CREATE INDEX IF NOT EXISTS idx_live_reports_date ON live_reports(report_date);
CREATE INDEX IF NOT EXISTS idx_live_reports_streamer ON live_reports(streamer_id);
CREATE INDEX IF NOT EXISTS idx_live_reports_sales ON live_reports(sales DESC);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_live_reports_timestamp ON live_reports;
CREATE TRIGGER trg_update_live_reports_timestamp
BEFORE UPDATE ON live_reports
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

-- ----------------------------------------------------------
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE streamers ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_reports ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user role
CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS TEXT AS $$
  SELECT role FROM users WHERE email = auth.jwt() ->> 'email' LIMIT 1;
$$ LANGUAGE sql STABLE;

-- Users RLS
CREATE POLICY "Users can read user list" ON users
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admin can manage users" ON users
  FOR ALL USING (auth_user_role() = 'admin');

-- Streamers RLS
CREATE POLICY "Authenticated users can view streamers" ON streamers
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admin and manager can manage streamers" ON streamers
  FOR ALL USING (auth_user_role() IN ('admin', 'manager'));

-- Live Reports RLS
CREATE POLICY "Authenticated users can view live reports" ON live_reports
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Operators, Managers, and Admins can insert reports" ON live_reports
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Operators can update their own reports or Admins/Managers can update all" ON live_reports
  FOR UPDATE USING (
    auth_user_role() IN ('admin', 'manager') 
    OR (auth_user_role() = 'operator' AND created_by = auth.uid())
  );

CREATE POLICY "Admins and Managers can delete reports" ON live_reports
  FOR DELETE USING (auth_user_role() IN ('admin', 'manager'));

-- ----------------------------------------------------------
-- 5. INITIAL SEED DATA
-- ----------------------------------------------------------
INSERT INTO streamers (id, name, username, status) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Andi Pratama', 'andipratama.live', 'active'),
  ('22222222-2222-2222-2222-222222222222', 'Siti Rahma', 'sitirahma_official', 'active'),
  ('33333333-3333-3333-3333-333333333333', 'Budi Santoso', 'budisantoso_deals', 'active'),
  ('44444444-4444-4444-4444-444444444444', 'Citra Kirana', 'citrashopee_store', 'active')
ON CONFLICT (username) DO NOTHING;

INSERT INTO users (id, name, email, role, status) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Administrator SRA', 'admin@sra-analytics.com', 'admin', 'active'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Manager Livestream', 'manager@sra-analytics.com', 'manager', 'active'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Operator Input', 'operator@sra-analytics.com', 'operator', 'active')
ON CONFLICT (email) DO NOTHING;
