import { randomUUID } from "node:crypto";
import { ApiError } from "../lib/errors.js";
import { runCompletion } from "../services/llmClient.js";
import { BASELINE_CODE, CORRECTED_CODE, SCENARIO, SUITE_HASH, sha256 } from "./scenario.js";
import { verifyCandidate } from "./verifier.js";
import type { Investigation, InvestigationStore } from "./types.js";

const SYSTEM_PROMPT = "You are a coding agent. Return only a JavaScript ES module exporting quoteShipping(subtotalCents, discountCents). No markdown fences, imports, dependencies, or side effects.";
export type StartInput = { source: "fixture" | "live"; parentId?: string };

export class InvestigationService {
  private active = false;
  constructor(readonly store: InvestigationStore, readonly liveEnabled = false,
    private readonly generate = runCompletion, private readonly verify = verifyCandidate) {}

  async recoverInterrupted() {
    for (const record of await this.store.list()) {
      if (record.execution !== "running" || record.endedAt) continue;
      record.execution = "interrupted";
      record.endedAt = new Date().toISOString();
      record.error = "Server restarted before this attempt finished. Start a new attempt; external calls are not automatically replayed.";
      record.events.push({ at: record.endedAt, title: "Attempt interrupted", detail: record.error });
      await this.store.save(record);
    }
  }

  async start(input: StartInput) {
    if (input.source === "live" && !this.liveEnabled) throw new ApiError(403, "live_disabled", "Live generation is disabled on this server");
    if (this.active) throw new ApiError(409, "busy", "An investigation is already running. Try again when it finishes.");
    // Take the process-local lock before the first await.
    this.active = true;
    try { return await this.execute(input); }
    finally { this.active = false; }
  }

  private async execute(input: StartInput) {
    const parent = input.parentId ? await this.store.get(input.parentId) : null;
    if (input.parentId && !parent) throw new ApiError(404, "not_found", "Parent attempt not found");
    if (parent && (parent.source !== input.source || parent.scenarioId !== SCENARIO.id || !parent.endedAt || !parent.code)) {
      throw new ApiError(400, "invalid_parent", "Choose a finished attempt with code from the same source and scenario");
    }
    const instruction = parent
      ? `${SCENARIO.initialInstruction}\n\nCorrection: ${SCENARIO.correction}\n\nPrevious candidate:\n${parent.code}`
      : SCENARIO.initialInstruction;
    const record: Investigation = {
      id: randomUUID(), parentId: parent?.id ?? null, scenarioId: SCENARIO.id, source: input.source,
      createdAt: new Date().toISOString(), endedAt: null, execution: "running", verification: "not_run",
      instruction, systemPrompt: SYSTEM_PROMPT, requirement: SCENARIO.requirement, suiteHash: SUITE_HASH,
      code: null, codeHash: null, model: null, usage: null, checks: [], events: [], error: null,
      verifier: input.source === "fixture" ? "trusted-fixture-process" : "docker"
    };
    const event = async (title: string, detail: string) => {
      record.events.push({ at: new Date().toISOString(), title, detail });
      await this.store.save(record);
    };
    await event("Attempt created", parent ? `New attempt linked to ${parent.id}. Original evidence preserved.` : "Independent execution and verification outcomes are recorded.");
    try {
      if (input.source === "fixture") {
        record.code = parent ? CORRECTED_CODE : BASELINE_CODE;
        await event("Fixture response loaded", "Bundled, authored example. No model was called and no tokens were billed.");
      } else {
        await event("Model requested", "Generating a fresh candidate; the result may differ between attempts.");
        const result = await this.generate({ systemPrompt: SYSTEM_PROMPT, userPrompt: instruction, model: process.env.INVESTIGATION_MODEL || "gpt-4.1-mini" });
        record.code = result.text.replace(/^```(?:javascript|js)?\s*\n/, "").replace(/\n```\s*$/, "").trim();
        record.model = result.model;
        record.usage = result.usage ?? null;
        if (!record.code || record.code.length > 16000) throw new Error("Model response was empty or exceeded the 16,000 character candidate limit");
        await event("Model response received", "Generation completed. Correctness has not been established.");
      }
      record.codeHash = sha256(record.code!);
      await event("Verification started", input.source === "fixture" ? "Running the bundled candidate in a separate Node process." : "Running the candidate in a restricted Docker container without network access.");
      try {
        record.checks = await this.verify(record.code!, input.source);
        record.verification = record.checks.length > 0 && record.checks.every(check => check.passed) ? "passed" : "failed";
        await event("Verification completed", `${record.checks.filter(c => c.passed).length}/${record.checks.length} regression checks passed. This is evidence for this suite, not proof of general correctness.`);
      } catch (error) {
        record.verification = "error";
        record.error = error instanceof Error ? error.message : "Verifier unavailable";
        await event("Verification unavailable", record.error);
      }
      record.execution = "completed";
    } catch (error) {
      record.execution = "failed";
      record.error = error instanceof Error ? error.message : "Generation failed";
      await event("Execution failed", record.error);
    }
    record.endedAt = new Date().toISOString();
    await this.store.save(record);
    return record;
  }
}
