import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { once } from "node:events";
import express from "express";
import { FileInvestigationStore } from "../src/investigations/fileStore.js";
import { InvestigationService } from "../src/investigations/service.js";
import { investigationRouter } from "../src/investigations/routes.js";
import { errorHandler } from "../src/lib/errors.js";
import { BASELINE_CODE, CORRECTED_CODE, CASES, sha256 } from "../src/investigations/scenario.js";
import { dockerArgs, evaluateResults, verifyCandidate } from "../src/investigations/verifier.js";

async function fixture(t: { after: (fn: () => Promise<void>) => void }) {
  const directory = await fs.mkdtemp(path.join(tmpdir(), "investigation-test-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return { directory, store: new FileInvestigationStore(directory) };
}

test("real subprocess checks expose the discount regression and accept its correction", async () => {
  const baseline = await verifyCandidate(BASELINE_CODE, "fixture");
  assert.equal(baseline.filter(c => c.passed).length, 5);
  assert.deepEqual(baseline.filter(c => !c.passed).map(c => c.name), ["Discount crosses the threshold", "Fully discounted order"]);
  const corrected = await verifyCandidate(CORRECTED_CODE, "fixture");
  assert.equal(corrected.length, 7);
  assert.ok(corrected.every(c => c.passed));
});

test("the fixture verifier refuses arbitrary code even if labeled as a fixture", async () => {
  await assert.rejects(verifyCandidate("process.exit(0)", "fixture"), /Only bundled/);
});

test("malformed or incomplete verifier output cannot count as passing", () => {
  for (const value of ["[]", "null", "[0]", JSON.stringify(CASES.map(() => "599")), "not JSON"]) {
    assert.throws(() => evaluateResults(value));
  }
});

test("live verifier requests isolation and never auto-pulls an image", () => {
  const args = dockerArgs("/tmp/evidence", "test-candidate", "node:22-alpine");
  for (const flag of ["--network=none", "--read-only", "--cap-drop=ALL", "--security-opt=no-new-privileges", "--memory=128m", "--pids-limit=32", "--user=65534:65534", "--pull=never"]) assert.ok(args.includes(flag));
  assert.ok(args.includes("type=bind,src=/tmp/evidence,dst=/work,readonly"));
  assert.equal(args.includes("--privileged"), false);
});

test("a corrected attempt preserves original evidence and survives reopening the store", async t => {
  const { directory, store } = await fixture(t);
  const service = new InvestigationService(store);
  const original = await service.start({ source: "fixture" });
  assert.equal(original.execution, "completed");
  assert.equal(original.verification, "failed");
  assert.equal(original.model, null);
  const before = JSON.stringify(await store.get(original.id));
  const corrected = await service.start({ source: "fixture", parentId: original.id });
  assert.equal(corrected.verification, "passed");
  assert.equal(corrected.parentId, original.id);
  assert.equal(corrected.suiteHash, original.suiteHash);
  assert.equal(corrected.codeHash, sha256(CORRECTED_CODE));
  assert.equal(JSON.stringify(await store.get(original.id)), before);
  const reopened = new FileInvestigationStore(directory);
  assert.deepEqual(await reopened.get(corrected.id), corrected);
  assert.equal((await reopened.list()).length, 2);
  await assert.rejects(reopened.get("../../outside"), /Invalid investigation id/);
});

test("disabled live mode rejects before calling a provider or creating evidence", async t => {
  const { store } = await fixture(t);
  let called = false;
  const service = new InvestigationService(store, false, async () => { called = true; throw new Error("unexpected"); });
  await assert.rejects(service.start({ source: "live" }), /disabled/);
  assert.equal(called, false);
  assert.equal((await store.list()).length, 0);
});

test("live generation is passed to the isolated verifier, with usage and model preserved", async t => {
  const { store } = await fixture(t);
  const service = new InvestigationService(store, true,
    async () => ({ text: `\`\`\`js\n${CORRECTED_CODE}\`\`\``, model: "test-model", usage: { totalTokens: 42 } }),
    async (code, source) => { assert.equal(source, "live"); assert.equal(code, CORRECTED_CODE.trim()); return evaluateResults(JSON.stringify(CASES.map(c => c.expected))); });
  const record = await service.start({ source: "live" });
  assert.equal(record.execution, "completed");
  assert.equal(record.verification, "passed");
  assert.equal(record.model, "test-model");
  assert.equal(record.usage?.totalTokens, 42);
  assert.equal(record.verifier, "docker");
});

test("verifier infrastructure errors are distinct from regression failures", async t => {
  const { store } = await fixture(t);
  const service = new InvestigationService(store, true, async () => ({ text: CORRECTED_CODE, model: "test" }), async () => { throw new Error("Docker unavailable"); });
  const record = await service.start({ source: "live" });
  assert.equal(record.execution, "completed");
  assert.equal(record.verification, "error");
  assert.deepEqual(record.checks, []);
  assert.equal(record.error, "Docker unavailable");
  assert.ok(record.endedAt);
});

test("provider failures are persisted without running verification", async t => {
  const { store } = await fixture(t);
  let verified = false;
  const service = new InvestigationService(store, true, async () => { throw new Error("Provider timed out"); }, async () => { verified = true; return []; });
  const record = await service.start({ source: "live" });
  assert.equal(record.execution, "failed");
  assert.equal(record.verification, "not_run");
  assert.equal(verified, false);
  assert.equal((await store.get(record.id))?.error, "Provider timed out");
});

test("restart recovery marks incomplete attempts interrupted without retrying external calls", async t => {
  const { store } = await fixture(t);
  const service = new InvestigationService(store);
  const record = await service.start({ source: "fixture" });
  record.execution = "running"; record.endedAt = null;
  await store.save(record);
  await service.recoverInterrupted();
  const recovered = await store.get(record.id);
  assert.equal(recovered?.execution, "interrupted");
  assert.ok(recovered?.endedAt);
  assert.equal((await store.list()).length, 1);
});

test("concurrent submissions are rejected and the lock is released after completion", async t => {
  const { store } = await fixture(t);
  let release!: () => void;
  let signal!: () => void;
  const started = new Promise<void>(resolve => { signal = resolve; });
  const barrier = new Promise<void>(resolve => { release = resolve; });
  const service = new InvestigationService(store, true, async () => { signal(); await barrier; return { text: CORRECTED_CODE, model: "test" }; }, async () => evaluateResults(JSON.stringify(CASES.map(c => c.expected))));
  const first = service.start({ source: "live" });
  await started;
  await assert.rejects(service.start({ source: "fixture" }), /already running/);
  release(); await first;
  assert.equal((await service.start({ source: "fixture" })).execution, "completed");
});

test("HTTP API validates requests, preserves history, and returns honest outcomes", async t => {
  const { store } = await fixture(t);
  const app = express(); app.use(express.json());
  app.use("/api/investigations", investigationRouter(new InvestigationService(store)));
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}/api/investigations`;
  const post = (body: unknown) => fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  assert.equal((await post({ source: "fixture", code: "arbitrary" })).status, 400);
  assert.equal((await post({ source: "live" })).status, 403);
  assert.equal((await fetch(`${base}/not-a-uuid`)).status, 400);
  assert.equal((await fetch(`${base}/00000000-0000-4000-8000-000000000000`)).status, 404);
  const response = await post({ source: "fixture" });
  assert.equal(response.status, 201);
  const baseline = await response.json();
  assert.equal(baseline.verification, "failed");
  const corrected = await (await post({ source: "fixture", parentId: baseline.id })).json();
  assert.equal(corrected.verification, "passed");
  assert.equal((await (await fetch(`${base}/${baseline.id}`)).json()).verification, "failed");
  assert.equal((await (await fetch(base)).json()).length, 2);
});
