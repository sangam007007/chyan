/**
 * Admin Controller — Dashboard stats, activity log, and user management.
 *
 * Routes:
 * - GET  /stats            → Dashboard metrics (admin, super_admin)
 * - GET  /activity         → Paginated activity log (admin, super_admin)
 * - GET  /users            → Paginated user list (super_admin only)
 * - GET  /users/:id        → User detail with stats (super_admin only)
 * - PATCH /users/:id/role  → Change user role (super_admin only)
 *
 * All routes require JWT authentication + role check.
 */

import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";

import { jwtAuth } from "@/middleware/jwt-auth.js";
import { requireRole } from "@/middleware/require-role.js";
import { queryOne, queryMany } from "@/db/index.js";
import { logActivity, getActivityLog } from "@/services/admin-activity.service.js";
import { asyncHandler } from "@/utils/async-handler.js";

// ─── Validation Schemas ───────────────────────────────────────────────

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const userListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  role: z.enum(["student", "admin", "super_admin"]).optional(),
});

const roleUpdateSchema = z.object({
  role: z.enum(["student", "admin", "super_admin"]),
});

// ─── Helpers ──────────────────────────────────────────────────────────

/**
 * Get the start of the current day in IST as a UTC timestamp.
 */
function getISTTodayStart(): Date {
  const nowIST = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
  );
  const todayIST = new Date(
    nowIST.getFullYear(),
    nowIST.getMonth(),
    nowIST.getDate(),
  );
  // Convert back to UTC by subtracting IST offset (+5:30)
  return new Date(todayIST.getTime() - 5.5 * 60 * 60 * 1000);
}

/**
 * Get today's date string in IST (YYYY-MM-DD format) for activity_date comparison.
 */
function getISTTodayDateString(): string {
  const nowIST = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
  );
  const year = nowIST.getFullYear();
  const month = String(nowIST.getMonth() + 1).padStart(2, "0");
  const day = String(nowIST.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ─── Route Handlers ───────────────────────────────────────────────────

/**
 * GET /stats
 * Returns dashboard metrics: user counts, question/test counts,
 * recent users, recent tests, top exams.
 */
async function handleGetStats(_req: Request, res: Response): Promise<void> {
  const todayStart = getISTTodayStart();
  const todayDateStr = getISTTodayDateString();

  // Run all count queries in parallel
  const [
    totalUsersRow,
    activeTodayRow,
    totalQuestionsRow,
    totalTestsRow,
    draftTestsRow,
    attemptsTodayRow,
    recentUsers,
    recentTests,
    topExams,
  ] = await Promise.all([
    queryOne<{ count: string }>(`SELECT COUNT(*) as count FROM users`),
    queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM user_activities WHERE activity_date = $1`,
      [todayDateStr],
    ),
    queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM questions WHERE is_active = true`,
    ),
    queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM tests WHERE status = 'published'`,
    ),
    queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM tests WHERE status = 'draft'`,
    ),
    queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM test_attempts WHERE started_at >= $1`,
      [todayStart.toISOString()],
    ),
    queryMany<{ id: string; full_name: string; phone: string; created_at: string }>(
      `SELECT id, full_name, phone, created_at
       FROM users
       ORDER BY created_at DESC
       LIMIT 5`,
    ),
    queryMany<{ id: string; title_en: string; status: string; created_at: string }>(
      `SELECT id, title_en, status, created_at
       FROM tests
       ORDER BY created_at DESC
       LIMIT 5`,
    ),
    queryMany<{ exam_id: string; exam_name: string; user_count: string }>(
      `SELECT
         u.selected_exam_id as exam_id,
         e.name_en as exam_name,
         COUNT(*) as user_count
       FROM users u
       JOIN exams e ON e.id = u.selected_exam_id
       WHERE u.selected_exam_id IS NOT NULL
       GROUP BY u.selected_exam_id, e.name_en
       ORDER BY user_count DESC
       LIMIT 5`,
    ),
  ]);

  res.status(200).json({
    success: true,
    data: {
      totalUsers: parseInt(totalUsersRow?.count ?? "0", 10),
      activeToday: parseInt(activeTodayRow?.count ?? "0", 10),
      totalQuestions: parseInt(totalQuestionsRow?.count ?? "0", 10),
      totalTests: parseInt(totalTestsRow?.count ?? "0", 10),
      draftTests: parseInt(draftTestsRow?.count ?? "0", 10),
      attemptsToday: parseInt(attemptsTodayRow?.count ?? "0", 10),
      recentUsers,
      recentTests,
      topExams,
    },
  });
}

/**
 * GET /activity
 * Returns paginated admin activity log.
 */
async function handleGetActivity(req: Request, res: Response): Promise<void> {
  const parsed = paginationSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: parsed.error.errors[0]?.message || "Invalid pagination parameters",
      },
    });
    return;
  }

  const { page, limit } = parsed.data;
  const result = await getActivityLog(page, limit);

  res.status(200).json({
    success: true,
    data: result,
  });
}

/**
 * GET /users
 * Returns paginated user list with optional search and role filter.
 * Super_admin only.
 */
async function handleGetUsers(req: Request, res: Response): Promise<void> {
  const parsed = userListSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: parsed.error.errors[0]?.message || "Invalid query parameters",
      },
    });
    return;
  }

  const { page, limit, search, role } = parsed.data;
  const offset = (page - 1) * limit;

  // Build dynamic WHERE clause
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (search) {
    conditions.push(`(full_name ILIKE $${paramIndex} OR phone ILIKE $${paramIndex})`);
    params.push(`%${search}%`);
    paramIndex++;
  }

  if (role) {
    conditions.push(`role = $${paramIndex}`);
    params.push(role);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // Get total count
  const countRow = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM users ${whereClause}`,
    params,
  );
  const total = parseInt(countRow?.count ?? "0", 10);

  // Get paginated users
  const users = await queryMany<{
    id: string;
    full_name: string;
    phone: string;
    email: string | null;
    role: string;
    created_at: string;
  }>(
    `SELECT id, full_name, phone, email, role, created_at
     FROM users
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...params, limit, offset],
  );

  res.status(200).json({
    success: true,
    data: {
      users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
}

/**
 * GET /users/:id
 * Returns user detail with stats (attempt count, coin balance, created_at, last_active).
 * Super_admin only.
 */
async function handleGetUserDetail(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;

  const user = await queryOne<{
    id: string;
    full_name: string;
    phone: string;
    email: string | null;
    role: string;
    preferred_language: string;
    selected_exam_id: string | null;
    onboarding_completed: boolean;
    created_at: string;
    trial_ends_at: string;
    paid_until: string | null;
  }>(
    `SELECT id, full_name, phone, email, role, preferred_language,
            selected_exam_id, onboarding_completed, created_at, trial_ends_at, paid_until
     FROM users WHERE id = $1`,
    [id],
  );

  if (!user) {
    res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "User not found" },
    });
    return;
  }

  // Get stats in parallel
  const [attemptCountRow, coinBalanceRow, lastActivityRow] = await Promise.all([
    queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM test_attempts WHERE user_id = $1`,
      [id],
    ),
    queryOne<{ balance: number }>(
      `SELECT COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END), 0) as balance
       FROM coin_transactions WHERE user_id = $1`,
      [id],
    ),
    queryOne<{ activity_date: string }>(
      `SELECT activity_date FROM user_activities WHERE user_id = $1 ORDER BY activity_date DESC LIMIT 1`,
      [id],
    ),
  ]);

  res.status(200).json({
    success: true,
    data: {
      ...user,
      stats: {
        attemptCount: parseInt(attemptCountRow?.count ?? "0", 10),
        coinBalance: coinBalanceRow?.balance ?? 0,
        lastActive: lastActivityRow?.activity_date ?? null,
      },
    },
  });
}

/**
 * PATCH /users/:id/role
 * Updates a user's role and logs the activity.
 * Super_admin only.
 */
async function handleUpdateUserRole(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const adminId = req.user!.userId;

  // Validate request body
  const parsed = roleUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: parsed.error.errors[0]?.message || "Invalid role value",
      },
    });
    return;
  }

  const { role: newRole } = parsed.data;

  // Get current user to check existence and get old role
  const existingUser = await queryOne<{ id: string; role: string; full_name: string }>(
    `SELECT id, role, full_name FROM users WHERE id = $1`,
    [id],
  );

  if (!existingUser) {
    res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "User not found" },
    });
    return;
  }

  const oldRole = existingUser.role;

  // Prevent self-demotion
  if (id === adminId) {
    res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Cannot change your own role",
      },
    });
    return;
  }

  // Update role
  const updatedUser = await queryOne<{
    id: string;
    full_name: string;
    phone: string;
    email: string | null;
    role: string;
    created_at: string;
  }>(
    `UPDATE users SET role = $1 WHERE id = $2
     RETURNING id, full_name, phone, email, role, created_at`,
    [newRole, id],
  );

  // Log the activity
  await logActivity(adminId, "role_change", "user", id, {
    oldRole,
    newRole,
    userName: existingUser.full_name,
  });

  res.status(200).json({
    success: true,
    data: updatedUser,
  });
}

/**
 * PATCH /exams/:id/date
 * Updates an exam's date. Admin + super_admin.
 */
async function handleUpdateExamDate(req: Request, res: Response): Promise<void> {
  const examId = req.params.id as string;
  const { examDate } = req.body;

  // Validate: examDate should be null or a valid date string
  if (examDate !== null && examDate !== undefined && examDate !== '') {
    const parsed = new Date(examDate);
    if (isNaN(parsed.getTime())) {
      res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Invalid date format" },
      });
      return;
    }
  }

  const dateValue = examDate || null;

  const updated = await queryOne<{ id: string }>(
    `UPDATE exams SET exam_date = $1 WHERE id = $2 RETURNING id`,
    [dateValue, examId],
  );

  if (!updated) {
    res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Exam not found" },
    });
    return;
  }

  res.status(200).json({ success: true });
}

// ─── Router ───────────────────────────────────────────────────────────

const router = Router();

// All admin routes require JWT authentication
router.use(jwtAuth);

// Stats and activity — admin + super_admin
router.get("/stats", requireRole("admin", "super_admin"), asyncHandler(handleGetStats));
router.get("/activity", requireRole("admin", "super_admin"), asyncHandler(handleGetActivity));

// User management — super_admin only
router.get("/users", requireRole("super_admin"), asyncHandler(handleGetUsers));
router.get("/users/:id", requireRole("super_admin"), asyncHandler(handleGetUserDetail));
router.patch("/users/:id/role", requireRole("super_admin"), asyncHandler(handleUpdateUserRole));

// Exam management — admin + super_admin
router.patch("/exams/:id/date", requireRole("admin", "super_admin"), asyncHandler(handleUpdateExamDate));

export { router as adminRouter };
