/**
 * Admin Activity Service
 *
 * Handles logging admin actions and retrieving the activity log.
 * All admin operations (create, update, delete, publish, etc.) are
 * tracked for audit purposes.
 */

import { queryOne, queryMany } from "@/db/index.js";

// ─── Types ────────────────────────────────────────────────────────────

export interface ActivityLogEntry {
  id: string;
  admin_id: string;
  admin_name: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface PaginatedActivityLog {
  activities: ActivityLogEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Service Functions ────────────────────────────────────────────────

/**
 * Log an admin activity to the admin_activity_log table.
 */
export async function logActivity(
  adminId: string,
  action: string,
  entityType: string,
  entityId?: string,
  details?: Record<string, unknown>,
): Promise<void> {
  await queryOne(
    `INSERT INTO admin_activity_log (admin_id, action, entity_type, entity_id, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [adminId, action, entityType, entityId ?? null, details ? JSON.stringify(details) : null],
  );
}

/**
 * Get paginated activity log with admin name JOINed from users.
 */
export async function getActivityLog(
  page: number,
  limit: number,
): Promise<PaginatedActivityLog> {
  const offset = (page - 1) * limit;

  // Get total count
  const countRow = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM admin_activity_log`,
  );
  const total = parseInt(countRow?.count ?? "0", 10);

  // Get paginated entries with admin name
  const activities = await queryMany<ActivityLogEntry>(
    `SELECT
       aal.id,
       aal.admin_id,
       u.full_name as admin_name,
       aal.action,
       aal.entity_type,
       aal.entity_id,
       aal.details,
       aal.created_at
     FROM admin_activity_log aal
     JOIN users u ON u.id = aal.admin_id
     ORDER BY aal.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset],
  );

  return {
    activities,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}
