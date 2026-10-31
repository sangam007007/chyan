/**
 * Learning Engine Service — Core sequential learning flow management.
 *
 * Manages topic_progress rows to enforce sequential topic unlocking:
 * - Users must complete topics in order (by display_order within each subject)
 * - Completing all topics in a subject unlocks the first topic of the next subject
 * - Pass threshold: 80% accuracy on a topic test
 * - Awards 10 coins per topic completion
 */

import type { PoolClient } from "pg";
import { queryOne, queryMany } from "@/db/index.js";
import { withTransaction } from "@/db/index.js";

// ─── Constants ────────────────────────────────────────────────────────

const PASS_THRESHOLD = 80;
const COINS_PER_TOPIC = 10;

// ─── Types ────────────────────────────────────────────────────────────

export interface StudyPlanOverview {
  examId: string;
  examName: string;
  totalSubjects: number;
  completedSubjects: number;
  totalTopics: number;
  completedTopics: number;
  overallProgress: number;
  subjects: SubjectProgress[];
}

export interface SubjectProgress {
  id: string;
  nameEn: string;
  nameHi: string;
  displayOrder: number;
  status: "locked" | "in_progress" | "completed";
  topicCount: number;
  completedTopicCount: number;
  progress: number;
}

export interface TopicProgress {
  id: string;
  nameEn: string;
  nameHi: string;
  displayOrder: number;
  status: "locked" | "unlocked" | "in_progress" | "completed";
  bestAccuracy: number | null;
  attemptsCount: number;
  completedAt: string | null;
}

export interface CurrentTopicInfo {
  topicId: string;
  topicNameEn: string;
  topicNameHi: string;
  subjectId: string;
  subjectNameEn: string;
  subjectNameHi: string;
  status: string;
  bestAccuracy: number | null;
}

export interface UnlockResult {
  completed: boolean;
  unlockedTopicId: string | null;
  unlockedTopicName: string | null;
  subjectCompleted: boolean;
  coinsAwarded: number;
}

export interface ProgressSummary {
  overallProgress: number;
  totalTopics: number;
  completedTopics: number;
  currentTopic: CurrentTopicInfo | null;
  subjectProgress: { subjectId: string; nameEn: string; progress: number }[];
}


// ─── Service Functions ────────────────────────────────────────────────

/**
 * Initialize study plan for a user.
 * Creates topic_progress rows for all topics in display_order.
 * First topic of first subject = 'unlocked', rest = 'locked'.
 * Idempotent via ON CONFLICT DO NOTHING.
 */
export async function initializePlan(
  userId: string,
  examId: string,
): Promise<void> {
  // Get all subjects for the exam ordered by display_order
  const subjects = await queryMany<{ id: string; display_order: number }>(
    `SELECT id, display_order FROM subjects
     WHERE exam_id = $1
     ORDER BY display_order ASC`,
    [examId],
  );

  if (subjects.length === 0) return;

  // Get all topics grouped by subject, ordered by display_order
  const topics = await queryMany<{
    id: string;
    subject_id: string;
    display_order: number;
  }>(
    `SELECT t.id, t.subject_id, t.display_order
     FROM topics t
     JOIN subjects s ON s.id = t.subject_id
     WHERE s.exam_id = $1
     ORDER BY s.display_order ASC, t.display_order ASC`,
    [examId],
  );

  if (topics.length === 0) return;

  // First topic (first subject, first display_order) is unlocked
  const firstTopicId = topics[0].id;

  // Build values for batch insert
  const values: string[] = [];
  const params: unknown[] = [userId];
  let paramIdx = 2;

  for (const topic of topics) {
    const status = topic.id === firstTopicId ? "unlocked" : "locked";
    const unlockedAt = topic.id === firstTopicId ? "NOW()" : "NULL";
    values.push(
      `($1, $${paramIdx}, $${paramIdx + 1}, '${status}', ${unlockedAt === "NOW()" ? "NOW()" : "NULL"})`,
    );
    params.push(topic.subject_id, topic.id);
    paramIdx += 2;
  }

  await queryOne(
    `INSERT INTO topic_progress (user_id, subject_id, topic_id, status, unlocked_at)
     VALUES ${values.join(", ")}
     ON CONFLICT (user_id, topic_id) DO NOTHING`,
    params,
  );
}

/**
 * Get the full study plan with progress for a user.
 */
export async function getStudyPlan(userId: string): Promise<StudyPlanOverview> {
  // Get user's exam info
  const user = await queryOne<{
    selected_exam_id: string;
    exam_name: string;
  }>(
    `SELECT u.selected_exam_id, e.name_en as exam_name
     FROM users u
     JOIN exams e ON e.id = u.selected_exam_id
     WHERE u.id = $1`,
    [userId],
  );

  if (!user || !user.selected_exam_id) {
    return {
      examId: "",
      examName: "",
      totalSubjects: 0,
      completedSubjects: 0,
      totalTopics: 0,
      completedTopics: 0,
      overallProgress: 0,
      subjects: [],
    };
  }

  const subjects = await getSubjectsWithProgress(userId);

  const totalTopics = subjects.reduce((sum, s) => sum + s.topicCount, 0);
  const completedTopics = subjects.reduce(
    (sum, s) => sum + s.completedTopicCount,
    0,
  );
  const completedSubjects = subjects.filter(
    (s) => s.status === "completed",
  ).length;

  return {
    examId: user.selected_exam_id,
    examName: user.exam_name,
    totalSubjects: subjects.length,
    completedSubjects,
    totalTopics,
    completedTopics,
    overallProgress: totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0,
    subjects,
  };
}

/**
 * Get the user's current position (first topic with status 'unlocked' or 'in_progress').
 */
export async function getCurrentTopic(
  userId: string,
): Promise<CurrentTopicInfo | null> {
  const row = await queryOne<{
    topic_id: string;
    topic_name_en: string;
    topic_name_hi: string;
    subject_id: string;
    subject_name_en: string;
    subject_name_hi: string;
    status: string;
    best_accuracy: number | null;
  }>(
    `SELECT tp.topic_id, t.name_en as topic_name_en, t.name_hi as topic_name_hi,
            tp.subject_id, s.name_en as subject_name_en, s.name_hi as subject_name_hi,
            tp.status, tp.best_accuracy
     FROM topic_progress tp
     JOIN topics t ON t.id = tp.topic_id
     JOIN subjects s ON s.id = tp.subject_id
     WHERE tp.user_id = $1 AND tp.subject_id IN (SELECT id FROM subjects WHERE exam_id = (SELECT selected_exam_id FROM users WHERE id = $1)) AND tp.status IN ('unlocked', 'in_progress')
     ORDER BY s.display_order ASC, t.display_order ASC
     LIMIT 1`,
    [userId],
  );

  if (!row) return null;

  return {
    topicId: row.topic_id,
    topicNameEn: row.topic_name_en,
    topicNameHi: row.topic_name_hi,
    subjectId: row.subject_id,
    subjectNameEn: row.subject_name_en,
    subjectNameHi: row.subject_name_hi,
    status: row.status,
    bestAccuracy: row.best_accuracy,
  };
}

/**
 * Start a topic (mark as in_progress).
 * Validates that the topic is unlocked.
 */
export async function startTopic(
  userId: string,
  topicId: string,
): Promise<void> {
  const progress = await queryOne<{ status: string }>(
    `SELECT status FROM topic_progress
     WHERE user_id = $1 AND topic_id = $2`,
    [userId, topicId],
  );

  if (!progress) {
    throw new Error("Topic progress not found. Please initialize your study plan first.");
  }

  if (progress.status === "locked") {
    throw new ForbiddenError("This topic is locked. Complete the previous topic first.");
  }

  if (progress.status === "completed") {
    throw new ValidationError("This topic is already completed.");
  }

  // Mark as in_progress (only if currently unlocked)
  await queryOne(
    `UPDATE topic_progress
     SET status = 'in_progress'
     WHERE user_id = $1 AND topic_id = $2 AND status = 'unlocked'`,
    [userId, topicId],
  );
}

/**
 * Complete a topic after passing the topic test.
 * Uses a transaction for atomic unlock of next topic.
 */
export async function completeTopic(
  userId: string,
  topicId: string,
  accuracy: number,
): Promise<UnlockResult> {
  return withTransaction(async (client) => {
    // 1. Get current progress
    const progress = await queryOne<{
      id: string;
      status: string;
      subject_id: string;
      best_accuracy: number | null;
      attempts_count: number;
    }>(
      `SELECT id, status, subject_id, best_accuracy, attempts_count
       FROM topic_progress
       WHERE user_id = $1 AND topic_id = $2
       FOR UPDATE`,
      [userId, topicId],
      { client },
    );

    if (!progress) {
      throw new Error("Topic progress not found.");
    }

    if (progress.status === "locked") {
      throw new ForbiddenError("This topic is locked.");
    }

    if (progress.status === "completed") {
      throw new ValidationError("This topic is already completed.");
    }

    // 2. Update attempts count and best_accuracy
    const newBest =
      progress.best_accuracy === null
        ? accuracy
        : Math.max(progress.best_accuracy, accuracy);

    // 3. If accuracy < threshold, just update stats and return
    if (accuracy < PASS_THRESHOLD) {
      await queryOne(
        `UPDATE topic_progress
         SET best_accuracy = $1, attempts_count = attempts_count + 1
         WHERE user_id = $2 AND topic_id = $3`,
        [newBest, userId, topicId],
        { client },
      );

      return {
        completed: false,
        unlockedTopicId: null,
        unlockedTopicName: null,
        subjectCompleted: false,
        coinsAwarded: 0,
      };
    }

    // 4. Accuracy >= 80% — mark as completed
    await queryOne(
      `UPDATE topic_progress
       SET status = 'completed', best_accuracy = $1, attempts_count = attempts_count + 1,
           completed_at = NOW()
       WHERE user_id = $2 AND topic_id = $3`,
      [newBest, userId, topicId],
      { client },
    );

    // 5. Find next topic in same subject
    const currentTopic = await queryOne<{
      display_order: number;
      subject_id: string;
    }>(
      `SELECT t.display_order, t.subject_id
       FROM topics t WHERE t.id = $1`,
      [topicId],
      { client },
    );

    let unlockedTopicId: string | null = null;
    let unlockedTopicName: string | null = null;
    let subjectCompleted = false;

    if (currentTopic) {
      // Look for next topic in same subject
      const nextTopic = await queryOne<{ id: string; name_en: string }>(
        `SELECT t.id, t.name_en
         FROM topics t
         WHERE t.subject_id = $1 AND t.display_order > $2
         ORDER BY t.display_order ASC
         LIMIT 1`,
        [currentTopic.subject_id, currentTopic.display_order],
        { client },
      );

      if (nextTopic) {
        // Unlock next topic in same subject
        await queryOne(
          `UPDATE topic_progress
           SET status = 'unlocked', unlocked_at = NOW()
           WHERE user_id = $1 AND topic_id = $2 AND status = 'locked'`,
          [userId, nextTopic.id],
          { client },
        );
        unlockedTopicId = nextTopic.id;
        unlockedTopicName = nextTopic.name_en;
      } else {
        // Last topic in subject — check if all topics in subject are completed
        const incompleteCount = await queryOne<{ count: string }>(
          `SELECT COUNT(*) as count FROM topic_progress
           WHERE user_id = $1 AND subject_id = $2 AND status != 'completed'`,
          [userId, currentTopic.subject_id],
          { client },
        );

        if (incompleteCount && Number(incompleteCount.count) === 0) {
          subjectCompleted = true;

          // Get current subject's display_order
          const currentSubject = await queryOne<{ display_order: number; exam_id: string }>(
            `SELECT display_order, exam_id FROM subjects WHERE id = $1`,
            [currentTopic.subject_id],
            { client },
          );

          if (currentSubject) {
            // Find next subject
            const nextSubject = await queryOne<{ id: string }>(
              `SELECT id FROM subjects
               WHERE exam_id = $1 AND display_order > $2
               ORDER BY display_order ASC
               LIMIT 1`,
              [currentSubject.exam_id, currentSubject.display_order],
              { client },
            );

            if (nextSubject) {
              // Unlock first topic of next subject
              const firstTopicOfNext = await queryOne<{
                id: string;
                name_en: string;
              }>(
                `SELECT t.id, t.name_en
                 FROM topics t
                 WHERE t.subject_id = $1
                 ORDER BY t.display_order ASC
                 LIMIT 1`,
                [nextSubject.id],
                { client },
              );

              if (firstTopicOfNext) {
                await queryOne(
                  `UPDATE topic_progress
                   SET status = 'unlocked', unlocked_at = NOW()
                   WHERE user_id = $1 AND topic_id = $2 AND status = 'locked'`,
                  [userId, firstTopicOfNext.id],
                  { client },
                );
                unlockedTopicId = firstTopicOfNext.id;
                unlockedTopicName = firstTopicOfNext.name_en;
              }
            }
          }
        }
      }
    }

    // 6. Award coins (insert directly into coin_transactions)
    await client.query(
      `INSERT INTO coin_transactions (user_id, type, amount, reference_id)
       VALUES ($1, 'test_complete', $2, $3)`,
      [userId, COINS_PER_TOPIC, topicId],
    );

    return {
      completed: true,
      unlockedTopicId,
      unlockedTopicName,
      subjectCompleted,
      coinsAwarded: COINS_PER_TOPIC,
    };
  });
}

/**
 * Get progress summary (for dashboard sync).
 */
export async function getProgressSummary(
  userId: string,
): Promise<ProgressSummary> {
  const totals = await queryOne<{
    total: string;
    completed: string;
  }>(
    `SELECT COUNT(*) as total,
            COUNT(*) FILTER (WHERE status = 'completed') as completed
     FROM topic_progress
     WHERE user_id = $1 AND subject_id IN (SELECT id FROM subjects WHERE exam_id = (SELECT selected_exam_id FROM users WHERE id = $1))`,
    [userId],
  );

  const totalTopics = totals ? Number(totals.total) : 0;
  const completedTopics = totals ? Number(totals.completed) : 0;
  const overallProgress =
    totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

  const currentTopic = await getCurrentTopic(userId);

  const subjectRows = await queryMany<{
    subject_id: string;
    name_en: string;
    total: string;
    completed: string;
  }>(
    `SELECT tp.subject_id, s.name_en,
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE tp.status = 'completed') as completed
     FROM topic_progress tp
     JOIN subjects s ON s.id = tp.subject_id
     WHERE tp.user_id = $1 AND tp.subject_id IN (SELECT id FROM subjects WHERE exam_id = (SELECT selected_exam_id FROM users WHERE id = $1))
     GROUP BY tp.subject_id, s.name_en, s.display_order
     ORDER BY s.display_order ASC`,
    [userId],
  );

  const subjectProgress = subjectRows.map((r) => ({
    subjectId: r.subject_id,
    nameEn: r.name_en,
    progress:
      Number(r.total) > 0
        ? Math.round((Number(r.completed) / Number(r.total)) * 100)
        : 0,
  }));

  return {
    overallProgress,
    totalTopics,
    completedTopics,
    currentTopic,
    subjectProgress,
  };
}

/**
 * Get subjects with their unlock status.
 */
export async function getSubjectsWithProgress(
  userId: string,
): Promise<SubjectProgress[]> {
  const rows = await queryMany<{
    id: string;
    name_en: string;
    name_hi: string;
    display_order: number;
    topic_count: string;
    completed_count: string;
    unlocked_or_in_progress_count: string;
  }>(
    `SELECT s.id, s.name_en, s.name_hi, s.display_order,
            COUNT(tp.id) as topic_count,
            COUNT(tp.id) FILTER (WHERE tp.status = 'completed') as completed_count,
            COUNT(tp.id) FILTER (WHERE tp.status IN ('unlocked', 'in_progress')) as unlocked_or_in_progress_count
     FROM subjects s
     LEFT JOIN topic_progress tp ON tp.subject_id = s.id AND tp.user_id = $1 AND tp.subject_id IN (SELECT id FROM subjects WHERE exam_id = (SELECT selected_exam_id FROM users WHERE id = $1))
     WHERE s.exam_id = (SELECT selected_exam_id FROM users WHERE id = $1)
     GROUP BY s.id, s.name_en, s.name_hi, s.display_order
     ORDER BY s.display_order ASC`,
    [userId],
  );

  return rows.map((r) => {
    const topicCount = Number(r.topic_count);
    const completedCount = Number(r.completed_count);
    const unlockedOrInProgress = Number(r.unlocked_or_in_progress_count);

    let status: "locked" | "in_progress" | "completed";
    if (topicCount > 0 && completedCount === topicCount) {
      status = "completed";
    } else if (unlockedOrInProgress > 0 || completedCount > 0) {
      status = "in_progress";
    } else {
      status = "locked";
    }

    return {
      id: r.id,
      nameEn: r.name_en,
      nameHi: r.name_hi,
      displayOrder: r.display_order,
      status,
      topicCount,
      completedTopicCount: completedCount,
      progress: topicCount > 0 ? Math.round((completedCount / topicCount) * 100) : 0,
    };
  });
}

/**
 * Get topics for a specific subject with their status.
 */
export async function getTopicsForSubject(
  userId: string,
  subjectId: string,
): Promise<TopicProgress[]> {
  const rows = await queryMany<{
    id: string;
    name_en: string;
    name_hi: string;
    display_order: number;
    status: string;
    best_accuracy: number | null;
    attempts_count: number;
    completed_at: string | null;
  }>(
    `SELECT t.id, t.name_en, t.name_hi, t.display_order,
            COALESCE(tp.status, 'locked') as status,
            tp.best_accuracy, COALESCE(tp.attempts_count, 0) as attempts_count,
            tp.completed_at::text as completed_at
     FROM topics t
     LEFT JOIN topic_progress tp ON tp.topic_id = t.id AND tp.user_id = $1 AND tp.subject_id IN (SELECT id FROM subjects WHERE exam_id = (SELECT selected_exam_id FROM users WHERE id = $1))
     WHERE t.subject_id = $2
     ORDER BY t.display_order ASC`,
    [userId, subjectId],
  );

  return rows.map((r) => ({
    id: r.id,
    nameEn: r.name_en,
    nameHi: r.name_hi,
    displayOrder: r.display_order,
    status: (r.status as TopicProgress["status"]) || "locked",
    bestAccuracy: r.best_accuracy,
    attemptsCount: r.attempts_count,
    completedAt: r.completed_at,
  }));
}

/**
 * Check if a specific topic test can be taken.
 * Returns true if topic is 'in_progress' or 'unlocked'.
 */
export async function canTakeTopicTest(
  userId: string,
  topicId: string,
): Promise<boolean> {
  const row = await queryOne<{ status: string }>(
    `SELECT status FROM topic_progress
     WHERE user_id = $1 AND topic_id = $2`,
    [userId, topicId],
  );

  if (!row) return false;
  return row.status === "in_progress" || row.status === "unlocked";
}

// ─── Error Classes ────────────────────────────────────────────────────

class ForbiddenError extends Error {
  public readonly statusCode = 403;
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

class ValidationError extends Error {
  public readonly statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
