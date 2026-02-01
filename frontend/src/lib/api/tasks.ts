import { destroy, get, patch, post } from "./client";
import type { ApiList, Run, RunLog, Task, TaskStatus } from "../types";

type TaskInput = {
  title: string;
  description?: string;
  status?: TaskStatus;
};

type TaskUpdate = Partial<TaskInput>;

export function listTasks(limit = 100, offset = 0) {
  return get<ApiList<Task>>(`/tasks?limit=${limit}&offset=${offset}`);
}

export function createTask(payload: TaskInput) {
  return post<Task>("/tasks", payload);
}

export function getTask(id: string) {
  return get<Task>(`/tasks/${id}`);
}

export function updateTask(id: string, payload: TaskUpdate) {
  return patch<Task>(`/tasks/${id}`, payload);
}

export function deleteTask(id: string) {
  return destroy<void>(`/tasks/${id}`);
}

export function listRunsForTask(taskId: string, limit = 100, offset = 0) {
  return get<ApiList<Run>>(`/tasks/${taskId}/runs?limit=${limit}&offset=${offset}`);
}

export function getRun(id: string) {
  return get<Run>(`/runs/${id}`);
}

export function getRunLogs(id: string, limit = 100, offset = 0) {
  return get<ApiList<RunLog>>(`/runs/${id}/logs?limit=${limit}&offset=${offset}`);
}
