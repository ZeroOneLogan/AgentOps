import { Router } from "express";
import { z } from "zod";
import { parseSchema } from "../lib/validate.js";
import { sendError } from "../lib/errors.js";
import { createPullRequestFromRun, listAccessibleRepos } from "../services/prService.js";

const router = Router();

const prSchema = z.object({
  run_id: z.string().uuid(),
  repo_owner: z.string().min(1),
  repo_name: z.string().min(1),
  base_branch: z.string().min(1).default("main"),
  branch_name: z.string().min(1),
  commit_message: z.string().min(1),
  pr_title: z.string().min(1),
  pr_body: z.string().min(1),
  files: z.array(
    z.object({
      path: z.string().min(1),
      content: z.string()
    })
  ).min(1)
});

router.post("/repos", async (_req, res, next) => {
  try {
    const repos = await listAccessibleRepos();
    res.json({ data: repos });
  } catch (err) {
    next(err);
  }
});

router.post("/create-pr", async (req, res) => {
  try {
    const payload = parseSchema(prSchema, req.body, "Invalid PR payload");
    const result = await createPullRequestFromRun({
      run_id: payload.run_id,
      repo_owner: payload.repo_owner,
      repo_name: payload.repo_name,
      base_branch: payload.base_branch,
      branch_name: payload.branch_name,
      commit_message: payload.commit_message,
      pr_title: payload.pr_title,
      pr_body: payload.pr_body,
      files: payload.files
    });
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "GitHub PR failed";
    return sendError(res, 400, "github_error", message);
  }
});

export default router;
