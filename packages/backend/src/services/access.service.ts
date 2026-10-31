/**
 * Who may use the app.
 *
 * - Staff (admin / super_admin) always can.
 * - A student can while the paid plan is running (paid_until in the future),
 * - or while the 3-day free trial is running (trial_ends_at in the future).
 * - Otherwise the student is "expired" and every content API answers 402 until they pay.
 * The role is read from the database (not the token) so a changed role takes effect at once.
 */

import { queryOne } from "@/db/index.js";

export type AccessStatus = "trial" | "paid" | "expired";

export interface Access {
  status: AccessStatus;
  staff: boolean;
  trialEndsAt: string;
  paidUntil: string | null;
  /** Whole days left in the running trial / plan (0 when expired) */
  daysLeft: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export async function getAccess(userId: string): Promise<Access | null> {
  const u = await queryOne<{ role: string; trial_ends_at: string; paid_until: string | null }>(
    `SELECT role, trial_ends_at, paid_until FROM users WHERE id = $1`,
    [userId],
  );
  if (!u) return null;

  const now = Date.now();
  const trialEnd = new Date(u.trial_ends_at).getTime();
  const paidEnd = u.paid_until ? new Date(u.paid_until).getTime() : 0;
  const staff = u.role === "admin" || u.role === "super_admin";
  const left = (end: number) => Math.max(0, Math.ceil((end - now) / DAY_MS));

  let status: AccessStatus = "expired";
  let daysLeft = 0;
  if (staff) { status = "paid"; daysLeft = 9999; }
  else if (paidEnd > now) { status = "paid"; daysLeft = left(paidEnd); }
  else if (trialEnd > now) { status = "trial"; daysLeft = left(trialEnd); }

  return { status, staff, trialEndsAt: new Date(trialEnd).toISOString(), paidUntil: u.paid_until ? new Date(paidEnd).toISOString() : null, daysLeft };
}
