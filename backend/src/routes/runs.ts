import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { notFound, sendError } from "../lib/errors.js";
import { asyncHandler, parsePagination, parseSchema } from "../lib/validate.js";
import { executeSingleAgent, logEvent } from "../services/runner.js";
import { buildContextPrompt } from "../services/contextBuilder.js";
import { startSequentialWorkflow } from "../services/workflows/sequentialWorkflow.js";

const router = Router();

const runCreateSchema = z.object({
  taskId: z.string().uuid(),
  agentId: z.string().uuid()
});

const runExecuteSchema = z.object({
  task_id: z.string().uuid(),
  agent_id: z.string().uuid(),
  workspace_name: z.string().min(1).optional(),
  context_files: z.array(z.string().min(1)).optional()
});

const workflowExecuteSchema = z.object({
  task_id: z.string().uuid(),
  agent_ids: z.array(z.string().uuid()).length(3),
  workspace_name: z.string().min(1).optional(),
  context_files: z.array(z.string().min(1)).optional()
});

router.post(
  "/runs/execute-workflow",
  asyncHandler(async (req, res) => {
    const payload = parseSchema(workflowExecuteSchema, req.body, "Invalid workflow payload");

    const uniqueAgents = new Set(payload.agent_ids);
    if (uniqueAgents.size !== payload.agent_ids.length) {
      return sendError(res, 400, "validation_error", "Agents must be unique for workflow steps");
    }

    if ((payload.context_files && !payload.workspace_name) || (!payload.context_files && payload.workspace_name)) {
      return sendError(res, 400, "validation_error", "workspace_name and context_files must be provided together");
    }

    try {
      const { workflowId, runIds } = await startSequentialWorkflow(
        payload.task_id,
        payload.agent_ids,
        payload.workspace_name,
        payload.context_files
      );

      res.status(201).json({ workflow_run_id: workflowId, runs: runIds });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Workflow execution failed";
      const status = message.toLowerCase().includes("not found") ? 404 : 400;
      return sendError(res, status, "validation_error", message);
    }
  })
);

router.post(
  "/runs/execute",
  asyncHandler(async (req, res) => {
    const payload = parseSchema(runExecuteSchema, req.body, "Invalid run execution payload");

    if ((payload.context_files && !payload.workspace_name) || (!payload.context_files && payload.workspace_name)) {
      return sendError(res, 400, "validation_error", "workspace_name and context_files must be provided together");
    }

    const [task, agent] = await Promise.all([
      prisma.task.findUnique({ where: { id: payload.task_id } }),
      prisma.agent.findUnique({ where: { id: payload.agent_id } })
    ]);

    if (!task) {
      return sendError(res, 404, "not_found", "task not found");
    }
    if (!agent) {
      return sendError(res, 404, "not_found", "agent not found");
    }

    let context;
    try {
      context = await buildContextPrompt(
        task.title,
        task.description,
        payload.workspace_name,
        payload.context_files
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid workspace context";
      return sendError(res, 400, "validation_error", message);
    }

    const run = await prisma.$transaction(async (tx) => {
      const created = await tx.run.create({
        data: {
          taskId: payload.task_id,
          agentId: payload.agent_id,
          status: "queued",
          input: {
            workspace_name: payload.workspace_name,
            context_files: context.files,
            total_context_bytes: context.total_bytes
          }
        }
      });

      await tx.runLog.create({
        data: {
          runId: created.id,
          level: "info",
          message: "Run created",
          meta: { event: "run_created", context_files: context.files.map((file) => file.path) }
        }
      });

      return created;
    });

    await logEvent(run.id, "context_attached", "Context attached", {
      total_context_bytes: context.total_bytes,
      context_files: context.files.map((file) => file.path)
    });

    void executeSingleAgent({
      runId: run.id,
      systemPrompt: agent.systemPrompt,
      userPrompt: context.prompt,
      modelName: agent.modelName
    }).catch((error) => {
      console.error("[runner] execution failed", error);
    });

    res.status(201).json({ run_id: run.id, status: run.status });
  })
);

router.post(
  "/runs",
  asyncHandler(async (req, res) => {
    const payload = parseSchema(runCreateSchema, req.body, "Invalid run payload");

    const [task, agent] = await Promise.all([
      prisma.task.findUnique({ where: { id: payload.taskId } }),
      prisma.agent.findUnique({ where: { id: payload.agentId } })
    ]);

    if (!task) {
      return sendError(res, 404, "not_found", "task not found");
    }
    if (!agent) {
      return sendError(res, 404, "not_found", "agent not found");
    }

    const run = await prisma.$transaction(async (tx) => {
      const created = await tx.run.create({
        data: {
          taskId: payload.taskId,
          agentId: payload.agentId,
          status: "queued"
        }
      });

      await tx.runLog.create({
        data: {
          runId: created.id,
          level: "info",
          message: "Run queued"
        }
      });

      return created;
    });

    res.status(201).json(run);
  })
);

router.get(
  "/tasks/:id/runs",
  asyncHandler(async (req, res) => {
    const taskId = parseSchema(z.string().uuid(), req.params.id, "Invalid task id");
    const { limit, offset } = parsePagination(req.query);

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      return notFound(res, "task");
    }

    const [data, total] = await prisma.$transaction([
      prisma.run.findMany({
        where: { taskId },
        skip: offset,
        take: limit,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }]
      }),
      prisma.run.count({ where: { taskId } })
    ]);

    res.json({ data, limit, offset, total });
  })
);

router.get(
  "/runs/:id",
  asyncHandler(async (req, res) => {
    const id = parseSchema(z.string().uuid(), req.params.id, "Invalid run id");
    const run = await prisma.run.findUnique({ where: { id } });
    if (!run) {
      return notFound(res, "run");
    }
    res.json(run);
  })
);

router.get(
  "/runs/:id/logs",
  asyncHandler(async (req, res) => {
    const id = parseSchema(z.string().uuid(), req.params.id, "Invalid run id");
    const { limit, offset } = parsePagination(req.query);

    const run = await prisma.run.findUnique({ where: { id } });
    if (!run) {
      return notFound(res, "run");
    }

    const [data, total] = await prisma.$transaction([
      prisma.runLog.findMany({
        where: { runId: id },
        skip: offset,
        take: limit,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }]
      }),
      prisma.runLog.count({ where: { runId: id } })
    ]);

    res.json({ data, limit, offset, total });
  })
);

export default router;
