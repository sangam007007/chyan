/**
 * Public (no login) endpoints for the landing page.
 *
 * - GET /api/public/overview → exams on offer + live content counts
 *
 * Only aggregate numbers and exam names are returned — nothing user-specific. The result is
 * cached in memory for a few minutes so a burst of first-time visitors does not hit the database.
 */

import { Router } from "express";
import type { Request, Response } from "express";
import { queryMany, queryOne } from "@/db/index.js";

export const publicRouter = Router();

interface Overview {
  exams: { id: string; nameEn: string; nameHi: string; category: string | null }[];
  counts: { exams: number; subjects: number; topics: number; tests: number; freeTests: number };
}

const TTL_MS = 5 * 60 * 1000;
let cache: { at: number; data: Overview } | null = null;

async function loadOverview(): Promise<Overview> {
  const exams = await queryMany<{ id: string; name_en: string; name_hi: string; category: string | null }>(
    `SELECT id, name_en, name_hi, category FROM exams WHERE is_active = TRUE ORDER BY display_order, name_en`,
  );
  const c = await queryOne<{ subjects: string; topics: string; tests: string; free_tests: string }>(
    `SELECT
       (SELECT COUNT(*) FROM subjects) AS subjects,
       (SELECT COUNT(*) FROM topics) AS topics,
       (SELECT COUNT(*) FROM tests WHERE status = 'published') AS tests,
       (SELECT COUNT(*) FROM tests WHERE status = 'published' AND pricing_type = 'free') AS free_tests`,
  );
  return {
    exams: exams.map((e) => ({ id: e.id, nameEn: e.name_en, nameHi: e.name_hi, category: e.category })),
    counts: {
      exams: exams.length,
      subjects: Number(c?.subjects ?? 0),
      topics: Number(c?.topics ?? 0),
      tests: Number(c?.tests ?? 0),
      freeTests: Number(c?.free_tests ?? 0),
    },
  };
}

publicRouter.get("/overview", async (_req: Request, res: Response) => {
  try {
    if (!cache || Date.now() - cache.at > TTL_MS) cache = { at: Date.now(), data: await loadOverview() };
    res.set("Cache-Control", "public, max-age=60");
    res.json({ success: true, data: cache.data });
  } catch (err) {
    console.error("[Public] overview error:", err);
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to load overview" } });
  }
});
