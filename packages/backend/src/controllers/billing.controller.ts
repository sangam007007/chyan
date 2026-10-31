/**
 * Plan status and manual activation.
 *
 * - GET  /api/billing/status       → trial / paid / expired, days left, price
 * - POST /api/billing/checkout     → starts an online payment. No payment gateway is connected yet, so
 *                                    this answers 501 instead of pretending to sell something.
 * - POST /api/billing/admin/grant  → staff only: add months of paid access to a student (for example after
 *                                    confirming a UPI payment by hand). Every grant is logged.
 */

import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";

import { jwtAuth } from "@/middleware/jwt-auth.js";
import { requireRole } from "@/middleware/require-role.js";
import { queryOne, withTransaction } from "@/db/index.js";
import { asyncHandler } from "@/utils/async-handler.js";
import { getAccess } from "@/services/access.service.js";
import { PLAN } from "@/config/plan.js";

export const billingRouter = Router();
billingRouter.use(jwtAuth);

billingRouter.get("/status", asyncHandler(async (req: Request, res: Response) => {
  const access = await getAccess(req.user!.userId);
  if (!access) {
    res.status(401).json({ success: false, error: { code: "TOKEN_INVALID", message: "Account not found" } });
    return;
  }
  // serverNow lets the app show a countdown that does not depend on the phone's clock
  res.json({ success: true, data: { ...access, plan: PLAN, serverNow: new Date().toISOString() } });
}));

billingRouter.post("/checkout", (_req: Request, res: Response) => {
  res.status(501).json({
    success: false,
    error: { code: "PAYMENTS_NOT_ENABLED", message: "Online payment is not switched on yet." },
  });
});

const grantSchema = z.object({
  phone: z.string().regex(/^\d{10}$/, "10-digit phone number"),
  months: z.number().int().min(1).max(24).default(PLAN.months),
  note: z.string().max(200).optional(),
});

billingRouter.post("/admin/grant", requireRole("admin", "super_admin"), asyncHandler(async (req: Request, res: Response) => {
  const parsed = grantSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid input" } });
    return;
  }
  const { phone, months, note } = parsed.data;

  const result = await withTransaction(async (client) => {
    const found = await client.query<{ id: string }>(`SELECT id FROM users WHERE phone = $1 FOR UPDATE`, [phone]);
    if (found.rows.length === 0) return null;
    const userId = found.rows[0].id;
    // Renewing early adds on top of the time that is still left
    const upd = await client.query<{ paid_until: string }>(
      `UPDATE users
       SET paid_until = GREATEST(now(), COALESCE(paid_until, now())) + make_interval(months => $2), updated_at = now()
       WHERE id = $1 RETURNING paid_until`,
      [userId, months],
    );
    await client.query(
      `INSERT INTO subscription_grants (user_id, granted_by, months, paid_until_after, note) VALUES ($1, $2, $3, $4, $5)`,
      [userId, req.user!.userId, months, upd.rows[0].paid_until, note ?? null],
    );
    return { userId, paidUntil: upd.rows[0].paid_until };
  });

  if (!result) {
    res.status(404).json({ success: false, error: { code: "USER_NOT_FOUND", message: "No student with that phone number" } });
    return;
  }
  res.json({ success: true, data: { paidUntil: result.paidUntil, months } });
}));
