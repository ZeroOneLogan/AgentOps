export type EvidenceEvent = { at: string; title: string; detail: string };
export type CheckResult = { name: string; args: number[]; expected: number; actual: number | null; passed: boolean };
export type Investigation = {
  id: string;
  parentId: string | null;
  scenarioId: string;
  source: "fixture" | "live";
  createdAt: string;
  endedAt: string | null;
  execution: "running" | "completed" | "failed" | "interrupted";
  verification: "not_run" | "passed" | "failed" | "error";
  instruction: string;
  systemPrompt: string;
  requirement: string;
  suiteHash: string;
  code: string | null;
  codeHash: string | null;
  model: string | null;
  usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | null;
  checks: CheckResult[];
  events: EvidenceEvent[];
  error: string | null;
  verifier: "trusted-fixture-process" | "docker";
};
export interface InvestigationStore {
  list(): Promise<Investigation[]>;
  get(id: string): Promise<Investigation | null>;
  save(value: Investigation): Promise<void>;
}
