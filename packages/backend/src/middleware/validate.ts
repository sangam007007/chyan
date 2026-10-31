/**
 * Zod schema validation middleware factory.
 *
 * Usage:
 *   import { validate } from '@/middleware/validate.js';
 *   import { z } from 'zod';
 *
 *   const schema = z.object({ phone: z.string().length(10) });
 *   router.post('/otp/send', validate(schema), handler);
 *
 * On validation failure, responds with 422 and the standard error format:
 *   { success: false, error: { code: "VALIDATION_ERROR", message, details: { fieldErrors } } }
 */

import type { Request, Response, NextFunction } from "express";
import type { ZodSchema, ZodError } from "zod";

/**
 * Creates an Express middleware that validates `req.body` against the given Zod schema.
 * On success, replaces `req.body` with the parsed (type-safe) value and calls next().
 * On failure, returns a 422 JSON response with field-level error details.
 */
export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (result.success) {
      // Replace body with the parsed & transformed value
      req.body = result.data;
      next();
      return;
    }

    const zodError: ZodError = result.error;

    // Build a field-level error map: { fieldName: ["error1", "error2"] }
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of zodError.issues) {
      const path = issue.path.join(".") || "_root";
      if (!fieldErrors[path]) {
        fieldErrors[path] = [];
      }
      fieldErrors[path].push(issue.message);
    }

    res.status(422).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: { fieldErrors },
      },
    });
  };
}
