/**
 * Session Controller — Manages active session listing and remote session termination.
 *
 * Routes:
 * - GET  /api/sessions           → List all active sessions with device info
 * - DELETE /api/sessions/:sessionId → Terminate a specific remote session
 *
 * All routes require JWT authentication via the jwtAuth middleware.
 *
 * Requirements: 8.1–8.5
 */

import { Router } from "express";
import type { Request, Response } from "express";

import { jwtAuth } from "@/middleware/jwt-auth.js";
import { queryOne } from "@/db/index.js";
import { SessionService } from "@/services/session.service.js";
import { CannotTerminateCurrentSessionError } from "@/errors/session.errors.js";

const router = Router();
const sessionService = new SessionService();

/**
 * GET /api/sessions
 *
 * Returns a list of all active sessions for the authenticated user,
 * including device type, device info, IP address, city, last active timestamp,
 * and a flag indicating the current session.
 */
router.get("/", jwtAuth, async (req: Request, res: Response) => {
  try {
    const { userId, sessionId: currentSessionId } = req.user!;

    const sessions = await sessionService.listActive(userId);

    const response = sessions.map((session) => ({
      id: session.id,
      deviceType: session.device_type,
      deviceInfo: session.device_info,
      ipAddress: session.ip_address,
      city: session.city,
      lastActiveAt: session.last_active_at,
      createdAt: session.created_at,
      isCurrent: session.id === currentSessionId,
    }));

    res.json({ success: true, data: { sessions: response } });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Failed to retrieve sessions" },
    });
  }
});

/**
 * DELETE /api/sessions/:sessionId
 *
 * Terminates a specific session. Users cannot terminate their own current session
 * (they should use the logout endpoint instead).
 */
router.delete("/:sessionId", jwtAuth, async (req: Request, res: Response) => {
  try {
    const { sessionId: currentSessionId } = req.user!;
    const sessionId = req.params.sessionId as string;

    // Block self-termination (Requirement 8.5)
    if (sessionId === currentSessionId) {
      const error = new CannotTerminateCurrentSessionError();
      res.status(error.statusCode).json({
        success: false,
        error: { code: error.code, message: error.message },
      });
      return;
    }

    // Only your own sessions; someone else's session id gets the same answer as an unknown one
    const owned = await queryOne<{ id: string }>(
      `SELECT id FROM sessions WHERE id = $1 AND user_id = $2`,
      [sessionId, req.user!.userId],
    );
    if (!owned) {
      res.status(404).json({ success: false, error: { code: "SESSION_NOT_FOUND", message: "Session not found" } });
      return;
    }

    await sessionService.revoke(sessionId);

    res.json({ success: true, data: { message: "Session terminated successfully" } });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Failed to terminate session" },
    });
  }
});

export { router as sessionRouter };
