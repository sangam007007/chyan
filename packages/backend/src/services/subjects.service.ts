/**
 * Subjects Service — Handles querying subjects and topics
 * for hierarchical subject-wise test filtering.
 *
 * Requirements: 5.1, 5.3
 */

import { queryMany, queryOne } from "@/db/index.js";

// ─── Types ────────────────────────────────────────────────────────────

/** A subject belonging to an exam. */
export interface Subject {
  id: string;
  examId: string;
  nameEn: string;
  nameHi: string;
  displayOrder: number;
}

/** A topic belonging to a subject. */
export interface Topic {
  id: string;
  subjectId: string;
  nameEn: string;
  nameHi: string;
  displayOrder: number;
}

// ─── Service ──────────────────────────────────────────────────────────

/**
 * Fetch all subjects for a given exam, ordered by display_order.
 *
 * @param examId - The exam ID to filter subjects by
 * @returns Array of subjects ordered by display_order
 */
export async function getSubjectsByExam(examId: string): Promise<Subject[]> {
  const rows = await queryMany<{
    id: string;
    exam_id: string;
    name_en: string;
    name_hi: string;
    display_order: number;
  }>(
    `SELECT id, exam_id, name_en, name_hi, display_order
     FROM subjects
     WHERE exam_id = $1
     ORDER BY display_order ASC`,
    [examId]
  );

  return rows.map((row) => ({
    id: row.id,
    examId: row.exam_id,
    nameEn: row.name_en,
    nameHi: row.name_hi,
    displayOrder: row.display_order,
  }));
}

/**
 * Fetch all topics for a given subject, ordered by display_order.
 *
 * @param subjectId - The subject ID to filter topics by
 * @returns Array of topics ordered by display_order
 */
export async function getTopicsBySubject(
  subjectId: string
): Promise<Topic[]> {
  const rows = await queryMany<{
    id: string;
    subject_id: string;
    name_en: string;
    name_hi: string;
    display_order: number;
  }>(
    `SELECT id, subject_id, name_en, name_hi, display_order
     FROM topics
     WHERE subject_id = $1
     ORDER BY display_order ASC`,
    [subjectId]
  );

  return rows.map((row) => ({
    id: row.id,
    subjectId: row.subject_id,
    nameEn: row.name_en,
    nameHi: row.name_hi,
    displayOrder: row.display_order,
  }));
}

/**
 * Check if a subject exists by ID.
 *
 * @param subjectId - The subject ID to check
 * @returns true if the subject exists, false otherwise
 */
export async function subjectExists(subjectId: string): Promise<boolean> {
  const row = await queryOne<{ exists: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM subjects WHERE id = $1) AS exists`,
    [subjectId]
  );

  return row?.exists ?? false;
}
