import { Router } from "express";
import { z } from "zod";
import { parseSchema } from "../lib/validate";
import { sendError } from "../lib/errors";
import { getAgentMetrics, getOverviewMetrics, getRunsByDay, getRunsByStatus } from "../services/metricsService";

const router = Router();

const runsQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  group_by: z.enum(["day", "status"]).default("day")
});

router.get(
  "/overview",
  async (_req, res, next) => {
    try {
      const overview = await getOverviewMetrics();
      res.json(overview);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/runs",
  async (req, res, next) => {
    try {
      const { from, to, group_by } = parseSchema(runsQuerySchema, req.query, "Invalid metrics query");
      if ((from && !to) || (!from && to)) {
        return sendError(res, 400, "validation_error", "from and to must be provided together");
      }

      const data = group_by === "status" ? await getRunsByStatus(from, to) : await getRunsByDay(from, to);
      res.json({ group_by, data });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/agents",
  async (_req, res, next) => {
    try {
      const data = await getAgentMetrics();
      res.json({ data });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
