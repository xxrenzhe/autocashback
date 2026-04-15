CREATE TABLE IF NOT EXISTS google_ads_credentials (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT,
  client_secret TEXT,
  developer_token TEXT,
  login_customer_id TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS google_ads_accounts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL,
  descriptive_name TEXT,
  currency_code TEXT,
  time_zone TEXT,
  manager BOOLEAN NOT NULL DEFAULT FALSE,
  test_account BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, customer_id)
);

CREATE TABLE IF NOT EXISTS click_farm_tasks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  offer_id INTEGER NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  daily_click_count INTEGER NOT NULL DEFAULT 216,
  start_time TEXT NOT NULL DEFAULT '06:00',
  end_time TEXT NOT NULL DEFAULT '24:00',
  duration_days INTEGER NOT NULL DEFAULT 14,
  scheduled_start_date DATE NOT NULL,
  hourly_distribution TEXT NOT NULL DEFAULT '[]',
  timezone TEXT NOT NULL DEFAULT 'UTC',
  referer_config TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  pause_reason TEXT,
  pause_message TEXT,
  paused_at TIMESTAMPTZ,
  progress NUMERIC(5, 2) NOT NULL DEFAULT 0,
  total_clicks INTEGER NOT NULL DEFAULT 0,
  success_clicks INTEGER NOT NULL DEFAULT 0,
  failed_clicks INTEGER NOT NULL DEFAULT 0,
  daily_history TEXT NOT NULL DEFAULT '[]',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_click_farm_tasks_user_status
  ON click_farm_tasks(user_id, status);

CREATE INDEX IF NOT EXISTS idx_click_farm_tasks_next_run_at
  ON click_farm_tasks(next_run_at);

ALTER TABLE link_swap_tasks ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'script';
ALTER TABLE link_swap_tasks ADD COLUMN IF NOT EXISTS google_customer_id TEXT;
ALTER TABLE link_swap_tasks ADD COLUMN IF NOT EXISTS google_campaign_id TEXT;
ALTER TABLE link_swap_tasks ADD COLUMN IF NOT EXISTS duration_days INTEGER NOT NULL DEFAULT -1;

ALTER TABLE link_swap_runs ADD COLUMN IF NOT EXISTS apply_status TEXT NOT NULL DEFAULT 'not_applicable';
ALTER TABLE link_swap_runs ADD COLUMN IF NOT EXISTS apply_error_message TEXT;
