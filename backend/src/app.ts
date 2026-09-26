import { InvestigationService } from "./investigations/service.js";
import { PrismaInvestigationStore } from "./investigations/prismaStore.js";
import { investigationRouter } from "./investigations/routes.js";
import express from "express";
import cors from "cors";
import { createRequire } from "node:module";
import agentsRouter from "./routes/agents.js";
import tasksRouter from "./routes/tasks.js";
import runsRouter from "./routes/runs.js";
import metricsRouter from "./routes/metrics.js";
import workspacesRouter from "./routes/workspaces.js";
import githubRouter from "./routes/github.js";
import { errorHandler, sendError } from "./lib/errors.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json");

export const investigations = new InvestigationService(new PrismaInvestigationStore(), process.env.ENABLE_LIVE_INVESTIGATIONS === "true");
const app = express();

app.use(cors({ origin: ["http://localhost:5173", "http://127.0.0.1:5173"] }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/version", (_req, res) => {
  res.json({ name: "agentops", version: pkg.version || "0.0.0" });
});

app.use("/api/investigations", investigationRouter(investigations));
app.use("/api/agents", agentsRouter);
app.use("/api/tasks", tasksRouter);
app.use("/api", runsRouter);
app.use("/api/metrics", metricsRouter);
app.use("/api/workspaces", workspacesRouter);
app.use("/api/github", githubRouter);

app.use((req, res) => {
  sendError(res, 404, "not_found", `Route ${req.method} ${req.path} not found`);
});

app.use(errorHandler);

export default app;
