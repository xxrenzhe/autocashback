UPDATE click_farm_tasks
SET is_deleted = 1,
    deleted_at = COALESCE(deleted_at, CURRENT_TIMESTAMP),
    status = 'stopped',
    next_run_at = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE is_deleted = 0
  AND id NOT IN (
    SELECT MAX(id)
    FROM click_farm_tasks
    WHERE is_deleted = 0
    GROUP BY user_id, offer_id
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_click_farm_tasks_user_offer_active
  ON click_farm_tasks(user_id, offer_id)
  WHERE is_deleted = 0;
