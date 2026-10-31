/**
 * Paywall for the API.
 *
 * `requireAccess` = log-in check + "has a running trial or paid plan". Put it in front of every router
 * that serves learning content. When the trial is over and nothing is paid it answers 402
 * SUBSCRIPTION_REQUIRED, which the app turns into the "buy a plan" popup.
 */

import type { NextFunction, Request, RequestHandler, Response } from "express";
import { jwtAuth } from "@/middleware/jwt-auth.js";
import { getAccess } from "@/services/access.service.js";
import { PLAN } from "@/config/plan.js";

async function checkAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const access = await getAccess(req.user!.userId);
    if (!access) {
      res.status(401).json({ success: false, error: { code: "TOKEN_INVALID", message: "Account not found" } });
      return;
    }
    if (access.status === "expired") {
      const hadPlan = access.paidUntil !== null;
      res.status(402).json({
        success: false,
        error: {
          code: "SUBSCRIPTION_REQUIRED",
          message: hadPlan ? "Your plan has ended. Renew to continue." : "Your free trial has ended. Buy a plan to continue.",
          details: { status: access.status, trialEndsAt: access.trialEndsAt, paidUntil: access.paidUntil, plan: PLAN },
        },
      });
      return;
    }
    next();
  } catch (err) {
    next(err);
  }
}

export const requireAccess: RequestHandler[] = [jwtAuth, checkAccess];
