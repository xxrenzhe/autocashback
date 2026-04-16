WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, offer_id
      ORDER BY updated_at DESC NULLS LAST, id DESC
    ) AS row_num
  FROM click_farm_tasks
  WHERE is_deleted = FALSE
)
UPDATE click_farm_tasks
SET is_deleted = TRUE,
    deleted_at = COALESCE(deleted_at, CURRENT_TIMESTAMP),
    status = 'stopped',
    next_run_at = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE id IN (
  SELECT id
  FROM ranked
  WHERE row_num > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_click_farm_tasks_user_offer_active
  ON click_farm_tasks(user_id, offer_id)
  WHERE is_deleted = FALSE;
