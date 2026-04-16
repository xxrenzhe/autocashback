CREATE TABLE IF NOT EXISTS unified_queue_tasks (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payload TEXT NOT NULL DEFAULT '{}',
  parent_request_id TEXT,
  priority TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'pending',
  available_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 0,
  worker_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_unified_queue_tasks_status_available
  ON unified_queue_tasks(status, available_at);

CREATE INDEX IF NOT EXISTS idx_unified_queue_tasks_type_status
  ON unified_queue_tasks(type, status);

CREATE INDEX IF NOT EXISTS idx_unified_queue_tasks_user_status
  ON unified_queue_tasks(user_id, status);
