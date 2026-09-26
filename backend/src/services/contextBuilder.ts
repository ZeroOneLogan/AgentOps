import { loadWorkspaceFiles, workspaceLimits } from "./workspaceService.js";

export type ContextFile = {
  path: string;
  size_bytes: number;
  language: string;
  content: string;
};

export type ContextResult = {
  prompt: string;
  total_bytes: number;
  files: Omit<ContextFile, "content">[];
};

function buildContextSection(files: ContextFile[]) {
  if (files.length === 0) return "";
  const parts = ["", "=== CONTEXT FILES ==="];
  for (const file of files) {
    parts.push(`File: ${file.path}`);
    parts.push(`\`\`\`${file.language}`);
    parts.push(file.content);
    parts.push("```");
  }
  return parts.join("\n");
}

export async function buildContextPrompt(
  taskTitle: string,
  taskDescription: string | null | undefined,
  workspaceName?: string | null,
  contextFiles?: string[]
) {
  const base = [
    "=== TASK ===",
    `Title: ${taskTitle}`,
    `Description: ${taskDescription || "(none)"}`
  ].join("\n");

  if (!workspaceName || !contextFiles || contextFiles.length === 0) {
    return {
      prompt: base,
      total_bytes: 0,
      files: []
    } satisfies ContextResult;
  }

  const files = await loadWorkspaceFiles(workspaceName, contextFiles);
  const totalBytes = files.reduce((sum, file) => sum + file.size_bytes, 0);

  if (totalBytes > workspaceLimits.MAX_TOTAL_BYTES) {
    throw new Error("Total context size exceeds limit");
  }

  const contextSection = buildContextSection(files);

  return {
    prompt: [base, contextSection].join("\n"),
    total_bytes: totalBytes,
    files: files.map(({ path, size_bytes, language }) => ({ path, size_bytes, language }))
  } satisfies ContextResult;
}
