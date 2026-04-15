CREATE TABLE IF NOT EXISTS google_ads_credentials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT,
  client_secret TEXT,
  developer_token TEXT,
  login_customer_id TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TEXT,
  last_verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS google_ads_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL,
  descriptive_name TEXT,
  currency_code TEXT,
  time_zone TEXT,
  manager INTEGER NOT NULL DEFAULT 0,
  test_account INTEGER NOT NULL DEFAULT 0,
  status TEXT,
  last_sync_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, customer_id)
);

CREATE TABLE IF NOT EXISTS click_farm_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  offer_id INTEGER NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  daily_click_count INTEGER NOT NULL DEFAULT 216,
  start_time TEXT NOT NULL DEFAULT '06:00',
  end_time TEXT NOT NULL DEFAULT '24:00',
  duration_days INTEGER NOT NULL DEFAULT 14,
  scheduled_start_date TEXT NOT NULL,
  hourly_distribution TEXT NOT NULL DEFAULT '[]',
  timezone TEXT NOT NULL DEFAULT 'UTC',
  referer_config TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  pause_reason TEXT,
  pause_message TEXT,
  paused_at TEXT,
  progress REAL NOT NULL DEFAULT 0,
  total_clicks INTEGER NOT NULL DEFAULT 0,
  success_clicks INTEGER NOT NULL DEFAULT 0,
  failed_clicks INTEGER NOT NULL DEFAULT 0,
  daily_history TEXT NOT NULL DEFAULT '[]',
  started_at TEXT,
  completed_at TEXT,
  next_run_at TEXT,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_click_farm_tasks_user_status
  ON click_farm_tasks(user_id, status);

CREATE INDEX IF NOT EXISTS idx_click_farm_tasks_next_run_at
  ON click_farm_tasks(next_run_at);

ALTER TABLE link_swap_tasks ADD COLUMN mode TEXT NOT NULL DEFAULT 'script';
ALTER TABLE link_swap_tasks ADD COLUMN google_customer_id TEXT;
ALTER TABLE link_swap_tasks ADD COLUMN google_campaign_id TEXT;
ALTER TABLE link_swap_tasks ADD COLUMN duration_days INTEGER NOT NULL DEFAULT -1;
ALTER TABLE link_swap_tasks ADD COLUMN activation_started_at TEXT;

ALTER TABLE link_swap_runs ADD COLUMN apply_status TEXT NOT NULL DEFAULT 'not_applicable';
ALTER TABLE link_swap_runs ADD COLUMN apply_error_message TEXT;
