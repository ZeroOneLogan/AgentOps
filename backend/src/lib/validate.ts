import type { Request, Response, NextFunction } from "express";
import { z, type ZodSchema } from "zod";
import { ApiError } from "./errors.js";

const queryNumber = (schema: z.ZodType<number>) =>
  z.preprocess((value) => {
    if (Array.isArray(value)) return value[0];
    if (value === "") return undefined;
    return value;
  }, schema);

export const paginationSchema = z
  .object({
    limit: queryNumber(z.coerce.number().int().min(1).max(100)).optional(),
    offset: queryNumber(z.coerce.number().int().min(0)).optional()
  })
  .passthrough();

export function parseSchema<T>(schema: ZodSchema<T>, data: unknown, message = "Invalid request"): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new ApiError(400, "validation_error", message, parsed.error.flatten());
  }
  return parsed.data;
}

export function parsePagination(query: { limit?: unknown; offset?: unknown }) {
  const { limit, offset } = parseSchema(
    paginationSchema,
    { limit: query.limit, offset: query.offset },
    "Invalid pagination parameters"
  );
  return {
    limit: limit ?? 20,
    offset: offset ?? 0
  };
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function requireBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.body = parseSchema(schema, req.body, "Invalid request body");
    next();
  };
}
