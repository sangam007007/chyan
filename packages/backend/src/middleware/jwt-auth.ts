/**
 * JWT Authentication Middleware
 *
 * Validates the access token from the Authorization header,
 * checks that the associated session is still active in Redis,
 * and attaches user context (userId, sessionId) to the request object.
 *
 * Error responses:
 * - 401 TOKEN_EXPIRED: Access token has expired (client should refresh)
 * - 401 TOKEN_INVALID: Token is malformed or signature invalid
 * - 401 SESSION_TERMINATED: Session no longer active in Redis
 *
 * Requirements: 7.2, 7.3, 11.3, 11.4
 */

import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

import { env } from "@/config/env.js";
import { getSessionMetadata } from "@/redis/session.js";

// ─── Type Augmentation ────────────────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        sessionId: string;
        role?: string;
      };
    }
  }
}

// ─── Types ────────────────────────────────────────────────────────────

interface JwtPayload {
  sub: string;
  sessionId: string;
  role?: string;
  iat: number;
  exp: number;
}

// ─── Middleware ───────────────────────────────────────────────────────

/**
 * Express middleware that validates JWT access tokens and attaches user context.
 *
 * Extracts the token from the `Authorization: Bearer <token>` header,
 * verifies its signature and expiry using the configured JWT_SECRET,
 * then checks that the session is still active in Redis.
 */
export function jwtAuth(req: Request, res: Response, next: NextFunction): void {
  // Already authenticated earlier in this request (routes can be gated by a parent middleware too)
  if (req.user) {
    next();
    return;
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      success: false,
      error: {
        code: "TOKEN_INVALID",
        message: "Missing or malformed authorization header",
      },
    });
    return;
  }

  const token = authHeader.slice(7); // Remove "Bearer " prefix

  if (!token) {
    res.status(401).json({
      success: false,
      error: {
        code: "TOKEN_INVALID",
        message: "Missing or malformed authorization header",
      },
    });
    return;
  }

  // Verify JWT signature and expiry
  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        error: {
          code: "TOKEN_EXPIRED",
          message: "Access token has expired",
        },
      });
      return;
    }

    // JsonWebTokenError (malformed), NotBeforeError, or other verification errors
    res.status(401).json({
      success: false,
      error: {
        code: "TOKEN_INVALID",
        message: "Invalid access token",
      },
    });
    return;
  }

  // Validate payload structure
  if (!payload.sub || !payload.sessionId) {
    res.status(401).json({
      success: false,
      error: {
        code: "TOKEN_INVALID",
        message: "Invalid token payload",
      },
    });
    return;
  }

  // Check session is still active in Redis
  getSessionMetadata(payload.sessionId)
    .then((session) => {
      if (!session) {
        res.status(401).json({
          success: false,
          error: {
            code: "SESSION_TERMINATED",
            message: "Session has been terminated",
          },
        });
        return;
      }

      // Attach user context to request
      req.user = {
        userId: payload.sub,
        sessionId: payload.sessionId,
        role: payload.role,
      };

      next();
    })
    .catch(() => {
      // Redis connection error — fail closed (deny access)
      res.status(401).json({
        success: false,
        error: {
          code: "TOKEN_INVALID",
          message: "Unable to validate session",
        },
      });
    });
}
