import { Router } from "express";
import { z } from "zod";
import { parseSchema } from "../lib/validate.js";
import { sendError } from "../lib/errors.js";
import { listWorkspaces, listWorkspaceTree, loadWorkspaceFile, workspaceLimits } from "../services/workspaceService.js";

const router = Router();

const fileQuerySchema = z.object({
  path: z.string().min(1)
});

router.get("/", async (_req, res, next) => {
  try {
    const data = await listWorkspaces();
    res.json({ data, limits: workspaceLimits });
  } catch (err) {
    next(err);
  }
});

router.get("/:name/tree", async (req, res, next) => {
  try {
    const name = req.params.name;
    if (!name) {
      return sendError(res, 400, "validation_error", "workspace name is required");
    }
    const files = await listWorkspaceTree(name);
    res.json({ data: files, limits: workspaceLimits });
  } catch (err) {
    next(err);
  }
});

router.get("/:name/file", async (req, res, next) => {
  try {
    const name = req.params.name;
    const { path } = parseSchema(fileQuerySchema, req.query, "Invalid file path");
    const file = await loadWorkspaceFile(name, path);
    res.json(file);
  } catch (err) {
    next(err);
  }
});

export default router;
