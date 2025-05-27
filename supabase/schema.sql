-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  extension_user_id TEXT UNIQUE NOT NULL,
  install_date TIMESTAMPTZ NOT NULL,
  last_active TIMESTAMPTZ NOT NULL
);

-- Create analytics events table
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  category TEXT NOT NULL,
  action TEXT NOT NULL,
  properties JSONB,
  timestamp TIMESTAMPTZ DEFAULT now()
);

-- Create watchlist items table
CREATE TABLE IF NOT EXISTS watchlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  asin TEXT NOT NULL,
  title TEXT NOT NULL,
  current_price DECIMAL(10, 2) NOT NULL,
  deal_signal TEXT NOT NULL,
  image_url TEXT,
  product_url TEXT,
  added_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, asin)
);

-- Create metrics summary view
CREATE OR REPLACE VIEW metrics_summary AS
SELECT
  (SELECT COUNT(*) FROM users) AS total_installs,
  (SELECT COUNT(*) FROM users WHERE install_date > now() - INTERVAL '30 days') AS new_users_last_30_days,
  (SELECT COUNT(*) FROM analytics_events WHERE category = 'priceChart' AND action = 'view') AS price_chart_views,
  (SELECT COUNT(*) FROM analytics_events WHERE category = 'priceChart' AND action = 'interact') AS price_chart_engagements,
  (SELECT COUNT(*) FROM analytics_events WHERE category = 'aiInsight' AND action = 'view') AS ai_insight_views,
  (SELECT COUNT(*) FROM analytics_events WHERE category = 'aiInsight' AND action = 'interact') AS ai_insight_engagements,
  (SELECT COUNT(*) FROM watchlist_items) AS products_watchlisted,
  (SELECT COUNT(DISTINCT asin) FROM watchlist_items) AS unique_products_watchlisted;

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist_items ENABLE ROW LEVEL SECURITY;

-- Create policies for users table
CREATE POLICY "Users can read their own data"
  ON users FOR SELECT
  USING (auth.uid() = id);

-- Create policies for analytics_events table
CREATE POLICY "Users can insert their own events"
  ON analytics_events FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can read all events"
  ON analytics_events FOR SELECT
  USING (true);

-- Create policies for watchlist_items table
CREATE POLICY "Users can read their own watchlist items"
  ON watchlist_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own watchlist items"
  ON watchlist_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own watchlist items"
  ON watchlist_items FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own watchlist items"
  ON watchlist_items FOR DELETE
  USING (auth.uid() = user_id);
