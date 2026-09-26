import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { notFound } from "../lib/errors.js";
import { asyncHandler, parsePagination, parseSchema } from "../lib/validate.js";

const router = Router();

const statusSchema = z.enum(["queued", "running", "succeeded", "failed"]);

const taskCreateSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1).optional(),
  status: statusSchema.optional()
});

const taskUpdateSchema = taskCreateSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided"
  });

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { limit, offset } = parsePagination(req.query);
    const [data, total] = await prisma.$transaction([
      prisma.task.findMany({
        skip: offset,
        take: limit,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }]
      }),
      prisma.task.count()
    ]);
    res.json({ data, limit, offset, total });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = parseSchema(taskCreateSchema, req.body, "Invalid task payload");
    const task = await prisma.task.create({
      data: {
        title: data.title,
        description: data.description,
        status: data.status
      }
    });
    res.status(201).json(task);
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseSchema(z.string().uuid(), req.params.id, "Invalid task id");
    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) {
      return notFound(res, "task");
    }
    res.json(task);
  })
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseSchema(z.string().uuid(), req.params.id, "Invalid task id");
    const payload = parseSchema(taskUpdateSchema, req.body, "Invalid task update");

    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing) {
      return notFound(res, "task");
    }

    const task = await prisma.task.update({
      where: { id },
      data: {
        title: payload.title,
        description: payload.description,
        status: payload.status
      }
    });

    res.json(task);
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseSchema(z.string().uuid(), req.params.id, "Invalid task id");
    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing) {
      return notFound(res, "task");
    }

    await prisma.task.delete({ where: { id } });
    res.status(204).send();
  })
);

export default router;
