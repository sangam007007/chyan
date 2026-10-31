/**
 * Student discussions.
 *
 * Endpoints (all need a logged-in student):
 * - GET    /api/discussions/room?testId=… | scope=exam → which room to open, and its title
 * - GET    /api/discussions?room=…&before=…&after=…    → messages of a room (oldest first)
 * - POST   /api/discussions                            → post text and/or one image (multipart)
 * - DELETE /api/discussions/:id                        → delete your own message (staff can delete any)
 * - POST   /api/discussions/:id/report                 → report a message
 *
 * Rooms:
 * - test:<testId>      a fixed test (mock, previous year, topic test…). Open to students who finished it,
 *                      so nobody can read answers before taking the test.
 * - subject:<subjectId> the generated full tests of a subject (each student gets different questions, so the
 *                      room is shared per subject). Open to students who finished one of them.
 * - exam:<examId>      the common community of an exam (Study tab). Open to students who picked that exam,
 *                      so changing the exam switches the community; old messages stay in the old one.
 *
 * Limits: 600 characters, one image per message (jpeg/png/webp, under 2 MB, re-encoded to webp so location
 * data is stripped), 4 images and 100 messages per student per day, and one message every 3 seconds.
 * Three different reports hide a message from everyone except its author and staff.
 */

import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import sharp from "sharp";
import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { env } from "@/config/env.js";
import { jwtAuth } from "@/middleware/jwt-auth.js";
import { queryMany, queryOne } from "@/db/index.js";
import { asyncHandler } from "@/utils/async-handler.js";

export const discussionsRouter = Router();
discussionsRouter.use(jwtAuth);

// ─── Limits ───────────────────────────────────────────────────────────

const MAX_BODY_CHARS = 600;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const IMAGES_PER_DAY = 4;
const MESSAGES_PER_DAY = 100;
const MIN_SECONDS_BETWEEN_MESSAGES = 3;
const REPORTS_TO_HIDE = 3;
const PAGE_SIZE = 30;
/** Start of the current day in India, as a timestamptz expression */
const TODAY_IST = `(date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata')`;

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES, files: 1 } });

function sendError(res: Response, status: number, code: string, message: string): void {
  res.status(status).json({ success: false, error: { code, message } });
}

const isStaff = (req: Request) => req.user?.role === "admin" || req.user?.role === "super_admin";

// ─── Rooms ────────────────────────────────────────────────────────────

const ROOM_RE = /^(test|subject|exam):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

function parseRoom(room: unknown): { kind: "test" | "subject" | "exam"; id: string } | null {
  if (typeof room !== "string") return null;
  const m = ROOM_RE.exec(room);
  return m ? { kind: m[1] as "test" | "subject" | "exam", id: m[2] } : null;
}

async function canAccessRoom(req: Request, room: { kind: "test" | "subject" | "exam"; id: string }): Promise<boolean> {
  if (isStaff(req)) return true;
  const userId = req.user!.userId;

  if (room.kind === "exam") {
    const u = await queryOne<{ selected_exam_id: string | null }>(`SELECT selected_exam_id FROM users WHERE id = $1`, [userId]);
    return u?.selected_exam_id === room.id;
  }
  if (room.kind === "test") {
    const r = await queryOne<{ ok: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM test_attempts
         WHERE user_id = $1 AND test_id = $2 AND status IN ('submitted', 'auto_submitted')
       ) AS ok`,
      [userId, room.id],
    );
    return !!r?.ok;
  }
  const r = await queryOne<{ ok: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM test_attempts ta
       JOIN dynamic_full_tests d ON d.test_id = ta.test_id
       WHERE ta.user_id = $1 AND d.subject_id = $2 AND ta.status IN ('submitted', 'auto_submitted')
     ) AS ok`,
    [userId, room.id],
  );
  return !!r?.ok;
}

// GET /api/discussions/room?testId=… | scope=exam
discussionsRouter.get("/room", asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  let room: string;
  let titleEn: string;
  let titleHi: string;

  if (req.query.scope === "exam") {
    const e = await queryOne<{ id: string; name_en: string; name_hi: string }>(
      `SELECT e.id, e.name_en, e.name_hi FROM users u JOIN exams e ON e.id = u.selected_exam_id WHERE u.id = $1`,
      [userId],
    );
    if (!e) return sendError(res, 404, "NO_EXAM", "Pick an exam first");
    room = `exam:${e.id}`;
    titleEn = `${e.name_en} community`;
    titleHi = `${e.name_hi} कम्युनिटी`;
  } else {
    const testId = z.string().uuid().safeParse(req.query.testId);
    if (!testId.success) return sendError(res, 400, "INVALID_ROOM", "testId is required");
    const t = await queryOne<{ title_en: string; title_hi: string; dyn_subject: string | null; s_en: string | null; s_hi: string | null }>(
      `SELECT t.title_en, t.title_hi,
              d.subject_id AS dyn_subject, s.name_en AS s_en, s.name_hi AS s_hi
       FROM tests t
       LEFT JOIN dynamic_full_tests d ON d.test_id = t.id
       LEFT JOIN subjects s ON s.id = d.subject_id
       WHERE t.id = $1`,
      [testId.data],
    );
    if (!t) return sendError(res, 404, "TEST_NOT_FOUND", "Test does not exist");
    if (t.dyn_subject) {
      room = `subject:${t.dyn_subject}`;
      titleEn = `${t.s_en} full tests`;
      titleHi = `${t.s_hi} फुल टेस्ट`;
    } else {
      room = `test:${testId.data}`;
      titleEn = t.title_en;
      titleHi = t.title_hi;
    }
  }

  const parsed = parseRoom(room)!;
  if (!(await canAccessRoom(req, parsed))) {
    return sendError(res, 403, "NOT_ALLOWED", "Finish this test to join its discussion");
  }
  const count = await queryOne<{ n: string }>(
    `SELECT COUNT(*) AS n FROM discussion_messages
     WHERE room_key = $1 AND deleted_at IS NULL AND hidden_at IS NULL`,
    [room],
  );
  res.json({ success: true, data: { room, kind: parsed.kind, titleEn, titleHi, messageCount: Number(count?.n ?? 0) } });
}));

// ─── Messages ─────────────────────────────────────────────────────────

interface MessageRow {
  id: string;
  user_id: string;
  body: string;
  image_path: string | null;
  report_count: number;
  hidden_at: string | null;
  created_at: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
}

function shape(row: MessageRow, req: Request) {
  const first = (row.full_name ?? "").trim().split(/\s+/)[0];
  const staff = isStaff(req);
  return {
    id: row.id,
    body: row.body,
    // images are only served to logged-in students who can open the room (see the image route below)
    imageUrl: row.image_path ? `/api/discussions/image/${row.image_path.replace(/^discussions\//, "")}` : null,
    createdAt: row.created_at,
    author: {
      // students by first name; admins and super admins appear as the team
      name: row.role === "student" ? (first || "Student") : "Chayan Team",
      avatarUrl: row.avatar_url,
      isStaff: row.role !== "student",
    },
    isMine: row.user_id === req.user!.userId,
    // only the author and staff ever see a hidden message
    underReview: !!row.hidden_at,
    reportCount: staff ? row.report_count : undefined,
  };
}

async function imagesLeftToday(userId: string): Promise<number> {
  const r = await queryOne<{ n: string }>(
    `SELECT COUNT(*) AS n FROM discussion_messages
     WHERE user_id = $1 AND image_path IS NOT NULL AND created_at >= ${TODAY_IST}`,
    [userId],
  );
  return Math.max(0, IMAGES_PER_DAY - Number(r?.n ?? 0));
}

// GET /api/discussions/image/:month/:file — a picture from a message, only for people who can open its room
discussionsRouter.get("/image/:month/:file", asyncHandler(async (req: Request, res: Response) => {
  const month = String(req.params.month);
  const file = String(req.params.file);
  if (!/^\d{4}-\d{2}$/.test(month) || !/^[0-9a-f-]{36}\.webp$/.test(file)) return sendError(res, 404, "NOT_FOUND", "Image not found");

  const m = await queryOne<{ room_key: string }>(
    `SELECT room_key FROM discussion_messages
     WHERE image_path = $1 AND deleted_at IS NULL AND (hidden_at IS NULL OR user_id = $2 OR $3::boolean)`,
    [`discussions/${month}/${file}`, req.user!.userId, isStaff(req)],
  );
  const room = m ? parseRoom(m.room_key) : null;
  if (!room || !(await canAccessRoom(req, room))) return sendError(res, 404, "NOT_FOUND", "Image not found");

  res.set("Cache-Control", "private, max-age=3600");
  res.sendFile(path.resolve(env.UPLOAD_DIR, "discussions", month, file));
}));

// GET /api/discussions?room=…
discussionsRouter.get("/", asyncHandler(async (req: Request, res: Response) => {
  const room = parseRoom(req.query.room);
  if (!room) return sendError(res, 400, "INVALID_ROOM", "Invalid room");
  if (!(await canAccessRoom(req, room))) return sendError(res, 403, "NOT_ALLOWED", "You cannot open this discussion");

  const roomKey = `${room.kind}:${room.id}`;
  const userId = req.user!.userId;
  const before = typeof req.query.before === "string" && !Number.isNaN(Date.parse(req.query.before)) ? req.query.before : null;
  const after = typeof req.query.after === "string" && !Number.isNaN(Date.parse(req.query.after)) ? req.query.after : null;

  const rows = await queryMany<MessageRow>(
    `SELECT * FROM (
       SELECT m.id, m.user_id, m.body, m.image_path, m.report_count, m.hidden_at, m.created_at,
              u.full_name, u.avatar_url, u.role
       FROM discussion_messages m
       JOIN users u ON u.id = m.user_id
       WHERE m.room_key = $1
         AND m.deleted_at IS NULL
         AND (m.hidden_at IS NULL OR m.user_id = $2 OR $3::boolean)
         AND ($4::timestamptz IS NULL OR m.created_at < $4::timestamptz)
         AND ($5::timestamptz IS NULL OR m.created_at > $5::timestamptz)
       ORDER BY m.created_at ${after ? "ASC" : "DESC"}
       LIMIT ${PAGE_SIZE + 1}
     ) page ORDER BY created_at ASC`,
    [roomKey, userId, isStaff(req), before, after],
  );

  // The extra row only tells us whether older messages exist
  const hasMore = !after && rows.length > PAGE_SIZE;
  const page = hasMore ? rows.slice(1) : rows;
  res.json({
    success: true,
    data: {
      messages: page.map((r) => shape(r, req)),
      hasMore,
      imagesLeftToday: await imagesLeftToday(userId),
      limits: { maxChars: MAX_BODY_CHARS, imagesPerDay: IMAGES_PER_DAY, maxImageMb: 2 },
    },
  });
}));

// Turn multer's errors into our error format
function acceptImage(req: Request, res: Response, next: NextFunction): void {
  upload.single("image")(req, res, (err: unknown) => {
    if (!err) return next();
    const code = (err as { code?: string }).code;
    if (code === "LIMIT_FILE_SIZE") return sendError(res, 413, "IMAGE_TOO_LARGE", "The image must be smaller than 2 MB");
    return sendError(res, 400, "UPLOAD_FAILED", "Could not read the upload");
  });
}

// POST /api/discussions
discussionsRouter.post("/", acceptImage, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const room = parseRoom(req.body?.room);
  if (!room) return sendError(res, 400, "INVALID_ROOM", "Invalid room");
  if (!(await canAccessRoom(req, room))) return sendError(res, 403, "NOT_ALLOWED", "You cannot post in this discussion");

  const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
  if (body.length > MAX_BODY_CHARS) return sendError(res, 400, "TOO_LONG", `Keep it under ${MAX_BODY_CHARS} characters`);
  const file = req.file;
  if (!body && !file) return sendError(res, 400, "EMPTY", "Write something or add an image");

  // Slow down spam
  const recent = await queryOne<{ last_secs: string | null; today: string }>(
    `SELECT EXTRACT(EPOCH FROM (now() - MAX(created_at)))::text AS last_secs,
            COUNT(*) FILTER (WHERE created_at >= ${TODAY_IST})::text AS today
     FROM discussion_messages WHERE user_id = $1 AND created_at >= now() - interval '2 days'`,
    [userId],
  );
  if (recent?.last_secs != null && Number(recent.last_secs) < MIN_SECONDS_BETWEEN_MESSAGES) {
    return sendError(res, 429, "SLOW_DOWN", "Please wait a few seconds before the next message");
  }
  if (Number(recent?.today ?? 0) >= MESSAGES_PER_DAY) {
    return sendError(res, 429, "DAILY_LIMIT", "You have reached today's message limit");
  }

  let imagePath: string | null = null;
  let savedFile: string | null = null;
  if (file) {
    if (file.size >= MAX_IMAGE_BYTES) return sendError(res, 413, "IMAGE_TOO_LARGE", "The image must be smaller than 2 MB");
    if ((await imagesLeftToday(userId)) <= 0) {
      return sendError(res, 429, "IMAGE_LIMIT", `You can upload ${IMAGES_PER_DAY} images per day`);
    }
    try {
      const meta = await sharp(file.buffer).metadata();
      if (!meta.format || !["jpeg", "png", "webp"].includes(meta.format)) {
        return sendError(res, 415, "IMAGE_TYPE", "Only JPG, PNG or WebP images are allowed");
      }
      const month = new Date().toISOString().slice(0, 7);
      const dir = path.resolve(env.UPLOAD_DIR, "discussions", month);
      await fs.mkdir(dir, { recursive: true });
      const name = `${randomUUID()}.webp`;
      // Re-encoding drops EXIF (location, camera) and anything hidden inside the file
      const out = await sharp(file.buffer)
        .rotate()
        .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      savedFile = path.join(dir, name);
      await fs.writeFile(savedFile, out);
      imagePath = `discussions/${month}/${name}`;
    } catch {
      return sendError(res, 415, "IMAGE_INVALID", "That file is not a valid image");
    }
  }

  try {
    const row = await queryOne<MessageRow>(
      `WITH ins AS (
         INSERT INTO discussion_messages (room_key, user_id, body, image_path)
         VALUES ($1, $2, $3, $4)
         RETURNING id, user_id, body, image_path, report_count, hidden_at, created_at
       )
       SELECT ins.*, u.full_name, u.avatar_url, u.role FROM ins JOIN users u ON u.id = ins.user_id`,
      [`${room.kind}:${room.id}`, userId, body, imagePath],
    );
    res.status(201).json({ success: true, data: { message: shape(row!, req), imagesLeftToday: await imagesLeftToday(userId) } });
  } catch (err) {
    if (savedFile) await fs.unlink(savedFile).catch(() => {});
    throw err;
  }
}));

// DELETE /api/discussions/:id
discussionsRouter.delete("/:id", asyncHandler(async (req: Request, res: Response) => {
  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) return sendError(res, 400, "INVALID_ID", "Invalid message");
  const m = await queryOne<{ user_id: string }>(
    `SELECT user_id FROM discussion_messages WHERE id = $1 AND deleted_at IS NULL`,
    [id.data],
  );
  if (!m) return sendError(res, 404, "NOT_FOUND", "Message not found");
  if (m.user_id !== req.user!.userId && !isStaff(req)) return sendError(res, 403, "FORBIDDEN", "You can only delete your own messages");
  await queryOne(`UPDATE discussion_messages SET deleted_at = now() WHERE id = $1 RETURNING id`, [id.data]);
  res.json({ success: true, data: { deleted: true } });
}));

// POST /api/discussions/:id/report
discussionsRouter.post("/:id/report", asyncHandler(async (req: Request, res: Response) => {
  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) return sendError(res, 400, "INVALID_ID", "Invalid message");
  const userId = req.user!.userId;
  const m = await queryOne<{ user_id: string; room_key: string }>(
    `SELECT user_id, room_key FROM discussion_messages WHERE id = $1 AND deleted_at IS NULL`,
    [id.data],
  );
  if (!m) return sendError(res, 404, "NOT_FOUND", "Message not found");
  const room = parseRoom(m.room_key);
  if (!room || !(await canAccessRoom(req, room))) return sendError(res, 403, "NOT_ALLOWED", "You cannot report this message");
  if (m.user_id === userId) return sendError(res, 400, "OWN_MESSAGE", "You cannot report your own message");

  const inserted = await queryOne<{ message_id: string }>(
    `INSERT INTO discussion_reports (message_id, user_id) VALUES ($1, $2)
     ON CONFLICT DO NOTHING RETURNING message_id`,
    [id.data, userId],
  );
  if (inserted) {
    await queryOne(
      `UPDATE discussion_messages
       SET report_count = report_count + 1,
           hidden_at = CASE WHEN report_count + 1 >= $2 AND hidden_at IS NULL THEN now() ELSE hidden_at END
       WHERE id = $1 RETURNING id`,
      [id.data, REPORTS_TO_HIDE],
    );
  }
  res.json({ success: true, data: { reported: true } });
}));
