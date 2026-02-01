import express from "express";
import cors from "cors";
import { createRequire } from "node:module";
import agentsRouter from "./routes/agents";
import tasksRouter from "./routes/tasks";
import runsRouter from "./routes/runs";
import metricsRouter from "./routes/metrics";
import workspacesRouter from "./routes/workspaces";
import githubRouter from "./routes/github";
import { errorHandler, sendError } from "./lib/errors";

const require = createRequire(import.meta.url);
const pkg = require("../package.json");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/version", (_req, res) => {
  res.json({ name: "agentops", version: pkg.version || "0.0.0" });
});

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
