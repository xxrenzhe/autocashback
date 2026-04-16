import type { QueueTaskType } from "@autocashback/domain";

import { getDbType, getSql } from "./client";
import { ensureDatabaseReady } from "./schema";

type RemovePendingQueueTasksInput = {
  userId?: number;
  types: QueueTaskType[];
  payloadField: "linkSwapTaskId" | "clickFarmTaskId";
  taskIds: Array<string | number>;
};

async function removePendingQueueTasksByPayloadField(input: RemovePendingQueueTasksInput) {
  await ensureDatabaseReady();

  const normalizedTaskIds = [...new Set(input.taskIds.map((taskId) => String(taskId).trim()).filter(Boolean))];
  if (!normalizedTaskIds.length || !input.types.length) {
    return { removedCount: 0 };
  }

  const sql = getSql();
  const dbType = getDbType();
  const typePlaceholders = input.types.map(() => "?").join(", ");
  const taskIdPlaceholders = normalizedTaskIds.map(() => "?").join(", ");
  const userFilter = typeof input.userId === "number" ? "AND user_id = ?" : "";
  const payloadExpression =
    dbType === "postgres"
      ? `jsonb_extract_path_text(payload::jsonb, '${input.payloadField}')`
      : `CAST(json_extract(payload, '$.${input.payloadField}') AS TEXT)`;

  const params: Array<string | number> = [
    ...input.types,
    ...normalizedTaskIds,
    ...(typeof input.userId === "number" ? [input.userId] : [])
  ];

  const rows = await sql.unsafe<{ id: string }[]>(
    `
      DELETE FROM unified_queue_tasks
      WHERE status = 'pending'
        AND type IN (${typePlaceholders})
        AND ${payloadExpression} IN (${taskIdPlaceholders})
        ${userFilter}
      RETURNING id
    `,
    params
  );

  return { removedCount: rows.length };
}

export async function removePendingLinkSwapQueueTasksByTaskIds(
  taskIds: Array<string | number>,
  userId?: number
) {
  return removePendingQueueTasksByPayloadField({
    userId,
    types: ["url-swap"],
    payloadField: "linkSwapTaskId",
    taskIds
  });
}

export async function removePendingClickFarmQueueTasksByTaskIds(
  taskIds: Array<string | number>,
  userId?: number
) {
  return removePendingQueueTasksByPayloadField({
    userId,
    types: ["click-farm-trigger", "click-farm-batch", "click-farm"],
    payloadField: "clickFarmTaskId",
    taskIds
  });
}
