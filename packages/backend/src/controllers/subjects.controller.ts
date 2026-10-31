/**
 * Subjects Controller — API endpoints for subjects and topics.
 *
 * Routes:
 * - GET /api/subjects              → List subjects for user's selected exam
 * - GET /api/subjects/:subjectId/topics → List topics for a subject
 *
 * All routes require JWT authentication.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */

import { Router } from "express";
import type { Request, Response } from "express";

import { jwtAuth } from "@/middleware/jwt-auth.js";
import { queryOne, queryMany } from "@/db/index.js";
import {
  getSubjectsByExam,
  getTopicsBySubject,
  subjectExists,
} from "@/services/subjects.service.js";

// ─── Route Handlers ───────────────────────────────────────────────────

/**
 * GET /api/subjects
 * Returns all subjects for the authenticated user's selected exam.
 */
async function listSubjects(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;

  try {
    // Fetch the user's selected_exam_id from the database
    const user = await queryOne<{ selected_exam_id: string | null }>(
      `SELECT selected_exam_id FROM users WHERE id = $1`,
      [userId],
    );

    if (!user || !user.selected_exam_id) {
      // Return all subjects if no exam selected (for new users)
      const allRows = await queryMany<{ id: string; exam_id: string; name_en: string; name_hi: string; display_order: number }>(
        `SELECT id, exam_id, name_en, name_hi, display_order FROM subjects ORDER BY display_order ASC`,
        [],
      );
      res.status(200).json({
        success: true,
        data: allRows.map((r) => ({ id: r.id, examId: r.exam_id, nameEn: r.name_en, nameHi: r.name_hi, displayOrder: r.display_order })),
      });
      return;
    }

    const subjects = await getSubjectsByExam(user.selected_exam_id);

    res.status(200).json({
      success: true,
      data: subjects,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Failed to fetch subjects" },
    });
  }
}

/**
 * GET /api/subjects/:subjectId/topics
 * Returns all topics for a given subject.
 */
async function listTopics(req: Request, res: Response): Promise<void> {
  const subjectId = req.params.subjectId as string;

  try {
    const exists = await subjectExists(subjectId);

    if (!exists) {
      res.status(404).json({
        success: false,
        error: {
          code: "SUBJECT_NOT_FOUND",
          message: "Subject not found",
        },
      });
      return;
    }

    const topics = await getTopicsBySubject(subjectId);

    res.status(200).json({
      success: true,
      data: topics,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Failed to fetch topics" },
    });
  }
}

// ─── Router ───────────────────────────────────────────────────────────

const router = Router();

// All routes require JWT authentication
router.use(jwtAuth);

router.get("/", listSubjects);
router.get("/:subjectId/topics", listTopics);

export default router;
