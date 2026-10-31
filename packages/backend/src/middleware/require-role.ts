/**
 * Role-Based Access Control Middleware
 *
 * Factory function that returns middleware to restrict route access
 * to users with specific roles. Must be placed AFTER jwtAuth in the
 * middleware chain so that req.user is populated.
 *
 * Usage:
 *   router.post("/", requireRole('admin', 'super_admin'), handler);
 */

import type { Request, Response, NextFunction } from "express";

/**
 * Returns Express middleware that checks req.user.role against the allowed roles.
 *
 * @param roles - One or more role strings that are permitted access
 * @returns Express middleware function
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // If jwtAuth was not applied or failed silently, req.user will be undefined
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: "TOKEN_INVALID",
          message: "Authentication required",
        },
      });
      return;
    }

    const userRole = req.user.role;

    if (!userRole || !roles.includes(userRole)) {
      res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Insufficient permissions",
        },
      });
      return;
    }

    next();
  };
}
