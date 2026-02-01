import { destroy, get, patch, post } from "./client";
import type { Agent, ApiList } from "../types";

type AgentInput = {
  name: string;
  role: string;
  systemPrompt: string;
  modelProvider?: string;
  modelName?: string;
};

type AgentUpdate = Partial<AgentInput>;

export function listAgents(limit = 100, offset = 0) {
  return get<ApiList<Agent>>(`/agents?limit=${limit}&offset=${offset}`);
}

export function createAgent(payload: AgentInput) {
  return post<Agent>("/agents", payload);
}

export function getAgent(id: string) {
  return get<Agent>(`/agents/${id}`);
}

export function updateAgent(id: string, payload: AgentUpdate) {
  return patch<Agent>(`/agents/${id}`, payload);
}

export function deleteAgent(id: string) {
  return destroy<void>(`/agents/${id}`);
}
