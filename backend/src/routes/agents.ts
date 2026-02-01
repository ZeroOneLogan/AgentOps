import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/db";
import { notFound } from "../lib/errors";
import { asyncHandler, parsePagination, parseSchema } from "../lib/validate";

const router = Router();

const agentCreateSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  systemPrompt: z.string().min(1),
  modelProvider: z.string().min(1).optional(),
  modelName: z.string().min(1).optional()
});

const agentUpdateSchema = agentCreateSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided"
  });

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { limit, offset } = parsePagination(req.query);
    const [data, total] = await prisma.$transaction([
      prisma.agent.findMany({
        skip: offset,
        take: limit,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }]
      }),
      prisma.agent.count()
    ]);

    res.json({ data, limit, offset, total });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = parseSchema(agentCreateSchema, req.body, "Invalid agent payload");
    const agent = await prisma.agent.create({
      data: {
        name: data.name,
        role: data.role,
        systemPrompt: data.systemPrompt,
        modelProvider: data.modelProvider,
        modelName: data.modelName
      }
    });
    res.status(201).json(agent);
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseSchema(z.string().uuid(), req.params.id, "Invalid agent id");
    const agent = await prisma.agent.findUnique({ where: { id } });
    if (!agent) {
      return notFound(res, "agent");
    }
    res.json(agent);
  })
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseSchema(z.string().uuid(), req.params.id, "Invalid agent id");
    const payload = parseSchema(agentUpdateSchema, req.body, "Invalid agent update");

    const existing = await prisma.agent.findUnique({ where: { id } });
    if (!existing) {
      return notFound(res, "agent");
    }

    const agent = await prisma.agent.update({
      where: { id },
      data: {
        name: payload.name,
        role: payload.role,
        systemPrompt: payload.systemPrompt,
        modelProvider: payload.modelProvider,
        modelName: payload.modelName
      }
    });

    res.json(agent);
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseSchema(z.string().uuid(), req.params.id, "Invalid agent id");
    const existing = await prisma.agent.findUnique({ where: { id } });
    if (!existing) {
      return notFound(res, "agent");
    }

    await prisma.agent.delete({ where: { id } });
    res.status(204).send();
  })
);

export default router;
