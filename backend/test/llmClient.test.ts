import test from "node:test";
import assert from "node:assert/strict";
import { runCompletion } from "../src/services/llmClient.js";

test("model client supplies a timeout signal, preserves usage, and rejects empty responses", async t => {
  const previousKey = process.env.LLM_API_KEY;
  process.env.LLM_API_KEY = "test-only";
  t.after(() => { if (previousKey === undefined) delete process.env.LLM_API_KEY; else process.env.LLM_API_KEY = previousKey; });
  const mock = t.mock.method(globalThis, "fetch", async (_url: unknown, options: RequestInit) => {
    assert.ok(options.signal instanceof AbortSignal);
    return new Response(JSON.stringify({ choices: [{ message: { content: "code" } }], model: "fixture", usage: { total_tokens: 10 } }));
  });
  assert.equal((await runCompletion({ systemPrompt: "test", userPrompt: "test", model: "fixture" })).usage?.totalTokens, 10);
  mock.mock.mockImplementation(async () => new Response(JSON.stringify({ choices: [] })));
  await assert.rejects(runCompletion({ systemPrompt: "test", userPrompt: "test", model: "fixture" }), /empty response/);
});
