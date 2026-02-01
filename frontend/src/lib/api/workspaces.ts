import { get } from "./client";

export type Workspace = { name: string };

export type WorkspaceLimits = {
  MAX_FILE_BYTES: number;
  MAX_TOTAL_BYTES: number;
  ALLOWED_EXTENSIONS: string[];
};

export type WorkspaceFile = {
  path: string;
  size_bytes: number;
  language: string;
};

export type WorkspaceFileContent = WorkspaceFile & {
  content: string;
};

export function listWorkspaces() {
  return get<{ data: Workspace[]; limits: WorkspaceLimits }>("/workspaces");
}

export function getWorkspaceTree(name: string) {
  return get<{ data: WorkspaceFile[]; limits: WorkspaceLimits }>(`/workspaces/${name}/tree`);
}

export function getWorkspaceFile(name: string, path: string) {
  const params = new URLSearchParams({ path });
  return get<WorkspaceFileContent>(`/workspaces/${name}/file?${params.toString()}`);
}
