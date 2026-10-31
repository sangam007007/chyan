/**
 * Coins Controller — Balance queries, transaction history, and earning events.
 *
 * Routes (all require jwtAuth):
 * - GET  /balance        → { success: true, data: { balance, lastEarnedAt } }
 * - GET  /history?limit=20&offset=0 → { success: true, data: { transactions, total } }
 * - POST /earn           → body: { type, referenceId? } → { success: true, data: { awarded, amount, newBalance } }
 *
 * Requirements: 4.1, 4.4, 4.5, 5.1, 7.1, 7.2, 8.1
 */

import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";

import { jwtAuth } from "@/middleware/jwt-auth.js";
import { getBalance, getHistory, earnCoins } from "@/services/coins.service.js";
import { asyncHandler } from "@/utils/async-handler.js";

// ─── Validation Schemas ───────────────────────────────────────────────

const historyQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(50).default(20),
  offset: z.coerce.number().min(0).default(0),
});

const earnBodySchema = z.object({
  type: z.enum([
    "daily_login",
    "streak_bonus_7",
    "referral",
    "quiz_complete",
    "test_complete",
  ]),
  referenceId: z.string().optional(),
});

// ─── Route Handlers ───────────────────────────────────────────────────

/**
 * GET /balance
 * Returns the authenticated user's coin balance and last earned timestamp.
 */
async function handleGetBalance(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const data = await getBalance(userId);

  res.status(200).json({ success: true, data });
}

/**
 * GET /history?limit=20&offset=0
 * Returns paginated coin transaction history.
 */
async function handleGetHistory(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;

  const parsed = historyQuerySchema.safeParse(req.query);
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

  const { limit, offset } = parsed.data;
  const data = await getHistory(userId, limit, offset);

  res.status(200).json({ success: true, data });
}

/**
 * POST /earn
 * Awards coins to the user for a specific event type.
 */
async function handleEarn(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;

  const parsed = earnBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: parsed.error.errors[0]?.message || "Invalid request body",
      },
    });
    return;
  }

  const { type, referenceId } = parsed.data;
  const data = await earnCoins(userId, type, referenceId);

  res.status(200).json({ success: true, data });
}

// ─── Router ───────────────────────────────────────────────────────────

const router = Router();

router.use(jwtAuth);

router.get("/balance", asyncHandler(handleGetBalance));
router.get("/history", asyncHandler(handleGetHistory));
router.post("/earn", asyncHandler(handleEarn));

export { router as coinsRouter };
