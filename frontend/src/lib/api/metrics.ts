import { get } from "./client";

export type OverviewMetrics = {
  total_runs: number;
  success_rate: number;
  failure_rate: number;
  avg_run_duration_ms: number;
  avg_workflow_duration_ms: number;
};

export type RunsByDay = {
  day: string;
  run_count: number;
};

export type RunsByStatus = {
  status: string;
  run_count: number;
};

export type AgentMetric = {
  agent_id: string;
  agent_name: string;
  run_count: number;
  success_rate: number;
  avg_duration_ms: number;
};

export function getOverview() {
  return get<OverviewMetrics>("/metrics/overview");
}

export function getRunsByDay(from?: string, to?: string) {
  const params = new URLSearchParams({ group_by: "day" });
  if (from && to) {
    params.set("from", from);
    params.set("to", to);
  }
  return get<{ group_by: "day"; data: RunsByDay[] }>(`/metrics/runs?${params.toString()}`);
}

export function getRunsByStatus(from?: string, to?: string) {
  const params = new URLSearchParams({ group_by: "status" });
  if (from && to) {
    params.set("from", from);
    params.set("to", to);
  }
  return get<{ group_by: "status"; data: RunsByStatus[] }>(`/metrics/runs?${params.toString()}`);
}

export function getAgentMetrics() {
  return get<{ data: AgentMetric[] }>("/metrics/agents");
}
