import { prisma } from "../lib/db";
import { logEvent } from "./runner";
import { createBranch, createPullRequest, getBranchSha, listRepos, upsertFile } from "./githubClient";

export type RepoInfo = {
  id: number;
  name: string;
  full_name: string;
  owner: string;
  default_branch: string;
  private: boolean;
};

export async function listAccessibleRepos() {
  return listRepos();
}

export type PrPayload = {
  run_id: string;
  repo_owner: string;
  repo_name: string;
  base_branch: string;
  branch_name: string;
  commit_message: string;
  pr_title: string;
  pr_body: string;
  files: Array<{ path: string; content: string }>;
};

export async function createPullRequestFromRun(payload: PrPayload) {
  const run = await prisma.run.findUnique({ where: { id: payload.run_id } });
  if (!run) {
    throw new Error("Run not found");
  }

  await logEvent(run.id, "github_pr_started", "GitHub PR creation started", {
    repo: `${payload.repo_owner}/${payload.repo_name}`,
    branch: payload.branch_name
  });

  const baseSha = await getBranchSha(payload.repo_owner, payload.repo_name, payload.base_branch);
  await createBranch(payload.repo_owner, payload.repo_name, payload.branch_name, baseSha);

  await logEvent(run.id, "github_branch_created", "GitHub branch created", {
    branch: payload.branch_name
  });

  for (const file of payload.files) {
    await upsertFile(
      payload.repo_owner,
      payload.repo_name,
      payload.branch_name,
      file.path,
      file.content,
      payload.commit_message
    );
    await logEvent(run.id, "github_commit_created", "GitHub commit created", {
      file: file.path
    });
  }

  const prUrl = await createPullRequest(
    payload.repo_owner,
    payload.repo_name,
    payload.base_branch,
    payload.branch_name,
    payload.pr_title,
    payload.pr_body
  );

  await logEvent(run.id, "github_pr_created", "GitHub PR created", {
    url: prUrl
  });

  await prisma.run.update({
    where: { id: run.id },
    data: {
      input: {
        ...(typeof run.input === "object" && run.input ? run.input : {}),
        github_pr_url: prUrl,
        github_branch: payload.branch_name
      }
    }
  });

  return { pull_request_url: prUrl, branch_name: payload.branch_name };
}
