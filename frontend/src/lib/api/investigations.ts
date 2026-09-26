import { get, post } from "./client";
export type Investigation = {
  id: string; parentId: string | null; scenarioId: string; source: "fixture" | "live";
  createdAt: string; endedAt: string | null;
  execution: "running" | "completed" | "failed" | "interrupted";
  verification: "not_run" | "passed" | "failed" | "error";
  instruction: string; systemPrompt: string; requirement: string; suiteHash: string;
  code: string | null; codeHash: string | null; model: string | null;
  usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | null;
  checks: Array<{ name: string; args: number[]; expected: number; actual: number | null; passed: boolean }>;
  events: Array<{ at: string; title: string; detail: string }>;
  error: string | null; verifier: string;
};
export type Scenario = { id: string; title: string; description: string; requirement: string; correction: string; liveEnabled: boolean };
export const listInvestigations = () => get<Investigation[]>("/investigations");
export const getInvestigation = (id: string) => get<Investigation>(`/investigations/${id}`);
export const getScenario = () => get<Scenario>("/investigations/scenario");
export const startInvestigation = (source: Investigation["source"], parentId?: string) => post<Investigation>("/investigations", { source, parentId });
