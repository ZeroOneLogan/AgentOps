import { post } from "./client";

type ExecutePayload = {
  task_id: string;
  agent_id: string;
  workspace_name?: string;
  context_files?: string[];
};

type ExecuteResponse = {
  run_id: string;
  status: "queued" | "running" | "succeeded" | "failed";
};

export function executeRun(payload: ExecutePayload) {
  return post<ExecuteResponse>("/runs/execute", payload);
}

type WorkflowPayload = {
  task_id: string;
  agent_ids: string[];
  workspace_name?: string;
  context_files?: string[];
};

type WorkflowResponse = {
  workflow_run_id: string;
  runs: string[];
};

export function executeWorkflow(payload: WorkflowPayload) {
  return post<WorkflowResponse>("/runs/execute-workflow", payload);
}
