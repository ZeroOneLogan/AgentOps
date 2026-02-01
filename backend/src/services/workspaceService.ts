import path from "node:path";
import { promises as fs } from "node:fs";

const ALLOWED_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".py", ".md", ".json", ".txt"]);
const MAX_FILE_BYTES = 100 * 1024;
const IGNORE_DIRS = new Set(["node_modules", ".git", "dist", "build"]);

export type WorkspaceFile = {
  path: string;
  size_bytes: number;
  language: string;
};

export type WorkspaceFileContent = WorkspaceFile & {
  content: string;
};

function getWorkspaceRoot() {
  const root = process.env.WORKSPACE_ROOT;
  if (!root) {
    throw new Error("WORKSPACE_ROOT is not configured");
  }
  return path.resolve(root);
}

function isAllowedExtension(filePath: string) {
  return ALLOWED_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function languageFromExt(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  return ext.startsWith(".") ? ext.slice(1) : ext || "text";
}

function normalizeWorkspacePath(workspaceRoot: string, workspaceName: string) {
  const resolved = path.resolve(workspaceRoot, workspaceName);
  if (!resolved.startsWith(workspaceRoot)) {
    throw new Error("Invalid workspace path");
  }
  return resolved;
}

function normalizeFilePath(workspaceRoot: string, workspaceName: string, relativePath: string) {
  const workspacePath = normalizeWorkspacePath(workspaceRoot, workspaceName);
  const resolved = path.resolve(workspacePath, relativePath);
  if (!resolved.startsWith(workspacePath)) {
    throw new Error("Invalid file path");
  }
  return { workspacePath, resolved };
}

export async function listWorkspaces() {
  const root = getWorkspaceRoot();
  const entries = await fs.readdir(root, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => ({ name: entry.name }));
}

async function walkDir(base: string, current: string, files: WorkspaceFile[]) {
  const entries = await fs.readdir(current, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      await walkDir(base, path.join(current, entry.name), files);
    } else if (entry.isFile()) {
      const fullPath = path.join(current, entry.name);
      if (!isAllowedExtension(fullPath)) continue;
      const stat = await fs.stat(fullPath);
      if (stat.size > MAX_FILE_BYTES) continue;
      const relativePath = path.relative(base, fullPath).replace(/\\/g, "/");
      files.push({
        path: relativePath,
        size_bytes: stat.size,
        language: languageFromExt(fullPath)
      });
    }
  }
}

export async function listWorkspaceTree(workspaceName: string) {
  const root = getWorkspaceRoot();
  const workspacePath = normalizeWorkspacePath(root, workspaceName);
  const files: WorkspaceFile[] = [];
  await walkDir(workspacePath, workspacePath, files);
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

export async function loadWorkspaceFiles(
  workspaceName: string,
  relativePaths: string[]
): Promise<WorkspaceFileContent[]> {
  const root = getWorkspaceRoot();
  const files: WorkspaceFileContent[] = [];

  for (const relPath of relativePaths) {
    const { workspacePath, resolved } = normalizeFilePath(root, workspaceName, relPath);
    if (!resolved.startsWith(workspacePath)) {
      throw new Error("Invalid file path");
    }
    if (!isAllowedExtension(resolved)) {
      throw new Error(`File type not allowed: ${relPath}`);
    }
    const stat = await fs.stat(resolved);
    if (stat.size > MAX_FILE_BYTES) {
      throw new Error(`File too large: ${relPath}`);
    }
    const content = await fs.readFile(resolved, "utf-8");
    files.push({
      path: relPath,
      size_bytes: stat.size,
      language: languageFromExt(resolved),
      content
    });
  }

  return files;
}

export async function loadWorkspaceFile(workspaceName: string, relativePath: string) {
  const root = getWorkspaceRoot();
  const { workspacePath, resolved } = normalizeFilePath(root, workspaceName, relativePath);
  if (!resolved.startsWith(workspacePath)) {
    throw new Error("Invalid file path");
  }
  if (!isAllowedExtension(resolved)) {
    throw new Error(`File type not allowed: ${relativePath}`);
  }
  const stat = await fs.stat(resolved);
  if (stat.size > MAX_FILE_BYTES) {
    throw new Error(`File too large: ${relativePath}`);
  }
  const content = await fs.readFile(resolved, "utf-8");
  return {
    path: relativePath,
    size_bytes: stat.size,
    language: languageFromExt(resolved),
    content
  };
}

export const workspaceLimits = {
  MAX_FILE_BYTES,
  MAX_TOTAL_BYTES: 300 * 1024,
  ALLOWED_EXTENSIONS: Array.from(ALLOWED_EXTENSIONS)
};
