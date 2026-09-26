import type { NextFunction, Request, Response } from "express";

export type ErrorPayload = {
  code: string;
  message: string;
  details?: unknown;
};

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function sendError(res: Response, status: number, code: string, message: string, details?: unknown) {
  const error: ErrorPayload = { code, message };
  if (details !== undefined) {
    error.details = details;
  }
  return res.status(status).json({ error });
}

export function notFound(res: Response, resource = "resource") {
  return sendError(res, 404, "not_found", `${resource} not found`);
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  void _next; // Express recognizes error middleware by its four-argument signature.
  if (err instanceof ApiError) {
    return sendError(res, err.status, err.code, err.message, err.details);
  }

  console.error("[api] unhandled error", err);
  return sendError(res, 500, "internal_error", "Unexpected server error");
}
