ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN failed_login_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN locked_until TEXT;

CREATE INDEX IF NOT EXISTS idx_users_role_active
  ON users(role, is_active);

CREATE INDEX IF NOT EXISTS idx_users_locked_until
  ON users(locked_until);
