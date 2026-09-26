import test from "node:test";
import assert from "node:assert/strict";
import { verifyCandidate } from "../src/investigations/verifier.js";
import { CORRECTED_CODE, BASELINE_CODE } from "../src/investigations/scenario.js";
import { InvestigationService } from "../src/investigations/service.js";

test("Docker executes arbitrary candidates with real pass, fail, and timeout outcomes", { skip: process.env.RUN_DOCKER_TESTS !== "true" }, async () => {
  assert.ok((await verifyCandidate(CORRECTED_CODE, "live")).every(check => check.passed));
  assert.equal((await verifyCandidate(BASELINE_CODE, "live")).filter(check => !check.passed).length, 2);
  await assert.rejects(verifyCandidate("export function quoteShipping() { while (true) {} }", "live"), /limit/);
});

test("Prisma stores complete evidence and parent lineage in PostgreSQL", { skip: process.env.RUN_DATABASE_TESTS !== "true" }, async t => {
  const { PrismaInvestigationStore } = await import("../src/investigations/prismaStore.js");
  const { prisma } = await import("../src/lib/db.js");
  const ids: string[] = [];
  t.after(async () => { await prisma.investigation.deleteMany({ where: { id: { in: ids } } }); await prisma.$disconnect(); });
  const store = new PrismaInvestigationStore();
  const service = new InvestigationService(store);
  const baseline = await service.start({ source: "fixture" }); ids.push(baseline.id);
  const corrected = await service.start({ source: "fixture", parentId: baseline.id }); ids.push(corrected.id);
  assert.equal(corrected.verification, "passed");
  assert.equal((await store.get(baseline.id))?.verification, "failed");
  assert.equal((await store.get(corrected.id))?.parentId, baseline.id);
});

test("a failed legacy workflow marks downstream steps skipped", { skip: process.env.RUN_DATABASE_TESTS !== "true" }, async t => {
  const { prisma } = await import("../src/lib/db.js");
  const { startSequentialWorkflow } = await import("../src/services/workflows/sequentialWorkflow.js");
  const task = await prisma.task.create({ data: { title: "Workflow failure regression" } });
  const agents = await Promise.all(["Planner", "Coder", "Reviewer"].map(role => prisma.agent.create({ data: { name: role, role, systemPrompt: "test" } })));
  const previousKey = process.env.LLM_API_KEY;
  process.env.LLM_API_KEY = "test-only";
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ error: { message: "Injected provider failure" } }), { status: 503 }));
  t.after(async () => {
    if (previousKey === undefined) delete process.env.LLM_API_KEY; else process.env.LLM_API_KEY = previousKey;
    await prisma.task.delete({ where: { id: task.id } });
    await prisma.agent.deleteMany({ where: { id: { in: agents.map(agent => agent.id) } } });
    await prisma.$disconnect();
  });
  const { runIds } = await startSequentialWorkflow(task.id, agents.map(agent => agent.id));
  const deadline = Date.now() + 5000;
  let runs = await prisma.run.findMany({ where: { id: { in: runIds } } });
  while (runs.some(run => run.status === "running" || run.status === "queued") && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 25));
    runs = await prisma.run.findMany({ where: { id: { in: runIds } } });
  }
  assert.deepEqual(runIds.map(id => runs.find(run => run.id === id)?.status), ["failed", "skipped", "skipped"]);
});
