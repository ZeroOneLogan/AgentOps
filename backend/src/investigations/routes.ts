import { Router } from "express";
import { z } from "zod";
import { asyncHandler, parseSchema } from "../lib/validate.js";
import { notFound } from "../lib/errors.js";
import { SCENARIO } from "./scenario.js";
import type { InvestigationService } from "./service.js";

export function investigationRouter(service: InvestigationService) {
  const router = Router();
  router.get("/scenario", (_req, res) => res.json({ ...SCENARIO, liveEnabled: service.liveEnabled }));
  router.get("/", asyncHandler(async (_req, res) => { res.json((await service.store.list()).slice(0, 50)); }));
  router.get("/:id", asyncHandler(async (req, res) => {
    const id = parseSchema(z.string().uuid(), req.params.id);
    const record = await service.store.get(id);
    if (!record) return notFound(res, "Investigation");
    res.json(record);
  }));
  router.post("/", asyncHandler(async (req, res) => {
    const input = parseSchema(z.object({ source: z.enum(["fixture", "live"]), parentId: z.string().uuid().optional() }).strict(), req.body);
    res.status(201).json(await service.start(input));
  }));
  return router;
}
