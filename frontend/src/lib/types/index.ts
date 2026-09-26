export type Agent = {
  id: string;
  name: string;
  role: string;
  systemPrompt: string;
  modelProvider?: string | null;
  modelName?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TaskStatus = "queued" | "running" | "succeeded" | "failed";

export type Task = {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
};

export type RunStatus = "queued" | "running" | "succeeded" | "failed" | "skipped";

export type Run = {
  id: string;
  taskId: string;
  agentId: string;
  status: RunStatus;
  startedAt?: string | null;
  endedAt?: string | null;
  input?: unknown;
  output?: unknown;
  error?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RunLogLevel = "debug" | "info" | "warn" | "error";

export type RunLog = {
  id: string;
  runId: string;
  level: RunLogLevel;
  message: string;
  meta?: unknown;
  createdAt: string;
};

export type ApiList<T> = {
  data: T[];
  limit: number;
  offset: number;
  total: number;
};

export type ApiError = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};
