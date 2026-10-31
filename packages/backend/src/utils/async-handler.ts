import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Express 4 does not catch rejected promises from async handlers: a thrown
 * AppError (e.g. "quiz already submitted") becomes an unhandled rejection and
 * kills the whole Node process. Wrapping forwards the error to the global
 * error handler so the client gets a proper 4xx/5xx JSON response instead.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown> | unknown,
): RequestHandler {
  // Returns the promise (typed as void for Express) so callers and tests can still await the handler.
  return ((req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next)) as unknown as RequestHandler;
}
