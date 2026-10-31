/**
 * Questions Controller — CRUD operations for the Question Bank.
 *
 * Routes:
 * - POST   /api/questions     → Create question with exam associations
 * - GET    /api/questions     → List questions with filters (subject, difficulty, exam)
 * - GET    /api/questions/:id → Get single question
 * - PUT    /api/questions/:id → Update question
 * - DELETE /api/questions/:id → Soft delete (set is_active=false)
 *
 * All routes require JWT authentication.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */

import { Router } from "express";
import type { Request, Response } from "express";

import { jwtAuth } from "@/middleware/jwt-auth.js";
import { requireRole } from "@/middleware/require-role.js";
import { validate } from "@/middleware/validate.js";
import {
  createQuestionSchema,
  updateQuestionSchema,
} from "@/schemas/question.schema.js";
import { queryOne, queryMany, withTransaction } from "@/db/index.js";

// ─── Types ────────────────────────────────────────────────────────────

interface QuestionRow {
  id: string;
  text_en: string;
  text_hi: string;
  option_a_en: string;
  option_a_hi: string;
  option_b_en: string;
  option_b_hi: string;
  option_c_en: string;
  option_c_hi: string;
  option_d_en: string;
  option_d_hi: string;
  correct_option: number;
  explanation_en: string | null;
  explanation_hi: string | null;
  subject: string;
  topic: string | null;
  difficulty: string;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface QuestionExamRow {
  exam_id: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────

/**
 * Format a database question row into API response format.
 */
function formatQuestion(row: QuestionRow, examIds?: string[]) {
  return {
    id: row.id,
    textEn: row.text_en,
    textHi: row.text_hi,
    options: [
      { en: row.option_a_en, hi: row.option_a_hi },
      { en: row.option_b_en, hi: row.option_b_hi },
      { en: row.option_c_en, hi: row.option_c_hi },
      { en: row.option_d_en, hi: row.option_d_hi },
    ],
    correctOption: row.correct_option,
    explanationEn: row.explanation_en,
    explanationHi: row.explanation_hi,
    subject: row.subject,
    topic: row.topic,
    difficulty: row.difficulty,
    imageUrl: row.image_url,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(examIds ? { examIds } : {}),
  };
}

// ─── Route Handlers ───────────────────────────────────────────────────

/**
 * POST /api/questions
 * Create a new question with exam associations.
 */
async function createQuestion(req: Request, res: Response): Promise<void> {
  const {
    textEn,
    textHi,
    options,
    correctOption,
    explanationEn,
    explanationHi,
    subject,
    topic,
    difficulty,
    imageUrl,
    examIds,
  } = req.body;

  try {
    const question = await withTransaction(async (client) => {
      // Insert into questions table
      const row = await queryOne<QuestionRow>(
        `INSERT INTO questions (
          text_en, text_hi,
          option_a_en, option_a_hi,
          option_b_en, option_b_hi,
          option_c_en, option_c_hi,
          option_d_en, option_d_hi,
          correct_option,
          explanation_en, explanation_hi,
          subject, topic, difficulty, image_url
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
        RETURNING *`,
        [
          textEn,
          textHi,
          options[0].en,
          options[0].hi,
          options[1].en,
          options[1].hi,
          options[2].en,
          options[2].hi,
          options[3].en,
          options[3].hi,
          correctOption,
          explanationEn || null,
          explanationHi || null,
          subject,
          topic || null,
          difficulty,
          imageUrl || null,
        ],
        { client },
      );

      if (!row) {
        throw new Error("Failed to insert question");
      }

      // Insert exam associations
      for (const examId of examIds) {
        await queryOne(
          `INSERT INTO question_exams (question_id, exam_id) VALUES ($1, $2)`,
          [row.id, examId],
          { client },
        );
      }

      return row;
    });

    res.status(201).json({
      success: true,
      data: formatQuestion(question, examIds),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Failed to create question" },
    });
  }
}

/**
 * GET /api/questions
 * List questions with optional filters: subject, difficulty, examId.
 */
async function listQuestions(req: Request, res: Response): Promise<void> {
  const { subject, difficulty, examId, page = "1", limit = "20" } = req.query;

  const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 20));
  const offset = (pageNum - 1) * limitNum;

  const conditions: string[] = ["q.is_active = true"];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (subject) {
    conditions.push(`q.subject = $${paramIndex++}`);
    params.push(subject);
  }

  if (difficulty) {
    conditions.push(`q.difficulty = $${paramIndex++}`);
    params.push(difficulty);
  }

  let joinClause = "";
  if (examId) {
    joinClause = `INNER JOIN question_exams qe ON qe.question_id = q.id`;
    conditions.push(`qe.exam_id = $${paramIndex++}`);
    params.push(examId);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  try {
    // Get total count
    const countResult = await queryOne<{ count: string }>(
      `SELECT COUNT(DISTINCT q.id) as count FROM questions q ${joinClause} ${whereClause}`,
      params,
    );
    const total = parseInt(countResult?.count || "0", 10);

    // Get paginated results
    const rows = await queryMany<QuestionRow>(
      `SELECT DISTINCT q.* FROM questions q ${joinClause} ${whereClause}
       ORDER BY q.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, limitNum, offset],
    );

    res.status(200).json({
      success: true,
      data: {
        questions: rows.map((row) => formatQuestion(row)),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Failed to list questions" },
    });
  }
}

/**
 * GET /api/questions/:id
 * Get a single question by ID with its exam associations.
 */
async function getQuestion(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  try {
    const question = await queryOne<QuestionRow>(
      `SELECT * FROM questions WHERE id = $1 AND is_active = true`,
      [id],
    );

    if (!question) {
      res.status(404).json({
        success: false,
        error: { code: "QUESTION_NOT_FOUND", message: "Question not found" },
      });
      return;
    }

    // Fetch exam associations
    const examRows = await queryMany<QuestionExamRow>(
      `SELECT exam_id FROM question_exams WHERE question_id = $1`,
      [id],
    );
    const examIds = examRows.map((r) => r.exam_id);

    res.status(200).json({
      success: true,
      data: formatQuestion(question, examIds),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Failed to get question" },
    });
  }
}

/**
 * PUT /api/questions/:id
 * Update an existing question. Only provided fields are updated.
 */
async function updateQuestion(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const body = req.body;

  // Build SET clause dynamically based on provided fields
  const setClauses: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (body.textEn !== undefined) {
    setClauses.push(`text_en = $${paramIndex++}`);
    params.push(body.textEn);
  }
  if (body.textHi !== undefined) {
    setClauses.push(`text_hi = $${paramIndex++}`);
    params.push(body.textHi);
  }
  if (body.options !== undefined) {
    setClauses.push(`option_a_en = $${paramIndex++}`);
    params.push(body.options[0].en);
    setClauses.push(`option_a_hi = $${paramIndex++}`);
    params.push(body.options[0].hi);
    setClauses.push(`option_b_en = $${paramIndex++}`);
    params.push(body.options[1].en);
    setClauses.push(`option_b_hi = $${paramIndex++}`);
    params.push(body.options[1].hi);
    setClauses.push(`option_c_en = $${paramIndex++}`);
    params.push(body.options[2].en);
    setClauses.push(`option_c_hi = $${paramIndex++}`);
    params.push(body.options[2].hi);
    setClauses.push(`option_d_en = $${paramIndex++}`);
    params.push(body.options[3].en);
    setClauses.push(`option_d_hi = $${paramIndex++}`);
    params.push(body.options[3].hi);
  }
  if (body.correctOption !== undefined) {
    setClauses.push(`correct_option = $${paramIndex++}`);
    params.push(body.correctOption);
  }
  if (body.explanationEn !== undefined) {
    setClauses.push(`explanation_en = $${paramIndex++}`);
    params.push(body.explanationEn);
  }
  if (body.explanationHi !== undefined) {
    setClauses.push(`explanation_hi = $${paramIndex++}`);
    params.push(body.explanationHi);
  }
  if (body.subject !== undefined) {
    setClauses.push(`subject = $${paramIndex++}`);
    params.push(body.subject);
  }
  if (body.topic !== undefined) {
    setClauses.push(`topic = $${paramIndex++}`);
    params.push(body.topic);
  }
  if (body.difficulty !== undefined) {
    setClauses.push(`difficulty = $${paramIndex++}`);
    params.push(body.difficulty);
  }
  if (body.imageUrl !== undefined) {
    setClauses.push(`image_url = $${paramIndex++}`);
    params.push(body.imageUrl);
  }

  // Always update updated_at
  setClauses.push(`updated_at = NOW()`);

  if (setClauses.length === 1) {
    // Only updated_at — no actual fields provided
    res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "No fields to update" },
    });
    return;
  }

  try {
    const result = await withTransaction(async (client) => {
      const question = await queryOne<QuestionRow>(
        `UPDATE questions SET ${setClauses.join(", ")}
         WHERE id = $${paramIndex} AND is_active = true
         RETURNING *`,
        [...params, id],
        { client },
      );

      if (!question) {
        return null;
      }

      // Update exam associations if provided
      if (body.examIds !== undefined) {
        await queryOne(
          `DELETE FROM question_exams WHERE question_id = $1`,
          [id],
          { client },
        );
        for (const examId of body.examIds) {
          await queryOne(
            `INSERT INTO question_exams (question_id, exam_id) VALUES ($1, $2)`,
            [id, examId],
            { client },
          );
        }
      }

      return question;
    });

    if (!result) {
      res.status(404).json({
        success: false,
        error: { code: "QUESTION_NOT_FOUND", message: "Question not found" },
      });
      return;
    }

    // Fetch updated exam associations
    const examRows = await queryMany<QuestionExamRow>(
      `SELECT exam_id FROM question_exams WHERE question_id = $1`,
      [id],
    );
    const examIds = examRows.map((r) => r.exam_id);

    res.status(200).json({
      success: true,
      data: formatQuestion(result, examIds),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Failed to update question" },
    });
  }
}

/**
 * DELETE /api/questions/:id
 * Soft delete — sets is_active=false.
 */
async function deleteQuestion(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  try {
    const question = await queryOne<QuestionRow>(
      `UPDATE questions SET is_active = false, updated_at = NOW()
       WHERE id = $1 AND is_active = true
       RETURNING *`,
      [id],
    );

    if (!question) {
      res.status(404).json({
        success: false,
        error: { code: "QUESTION_NOT_FOUND", message: "Question not found" },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: { message: "Question deleted successfully" },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Failed to delete question" },
    });
  }
}

// ─── Router ───────────────────────────────────────────────────────────

const router = Router();

// All routes require JWT authentication
router.use(jwtAuth);

router.post("/", requireRole('admin', 'super_admin'), validate(createQuestionSchema), createQuestion);
// These return the correct option and the explanation, so they are staff-only. Students get questions
// through a test (without answers) and through the review of their own attempt.
router.get("/", requireRole('admin', 'super_admin'), listQuestions);
router.get("/:id", requireRole('admin', 'super_admin'), getQuestion);
router.put("/:id", requireRole('admin', 'super_admin'), validate(updateQuestionSchema), updateQuestion);
router.delete("/:id", requireRole('admin', 'super_admin'), deleteQuestion);

export default router;
