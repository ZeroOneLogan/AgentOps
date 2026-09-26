import express from "express";
import cors from "cors";
import path from "node:path";
import { FileInvestigationStore } from "./investigations/fileStore.js";
import { InvestigationService } from "./investigations/service.js";
import { investigationRouter } from "./investigations/routes.js";
import { errorHandler } from "./lib/errors.js";

// No database, credentials, workspace reads, GitHub routes, or arbitrary execution.
const service = new InvestigationService(new FileInvestigationStore(path.resolve(process.env.DEMO_DATA_DIR || ".demo-data")));
await service.recoverInterrupted();
const app = express();
app.use(cors({ origin: ["http://localhost:5173", "http://127.0.0.1:5173"] }));
app.use(express.json({ limit: "32kb" }));
app.get("/health", (_req, res) => res.json({ ok: true, mode: "fixture-demo" }));
app.use("/api/investigations", investigationRouter(service));
app.use(errorHandler);
app.listen(Number(process.env.PORT || 4000), "127.0.0.1", () => console.log("[demo] Fixture API at http://127.0.0.1:4000"));
