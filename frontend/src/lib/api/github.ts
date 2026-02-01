import { post } from "./client";

export type RepoInfo = {
  id: number;
  name: string;
  full_name: string;
  owner: string;
  default_branch: string;
  private: boolean;
};

export type CreatePrPayload = {
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

export type CreatePrResponse = {
  pull_request_url: string;
  branch_name: string;
};

export function listRepos() {
  return post<{ data: RepoInfo[] }>("/github/repos");
}

export function createPullRequest(payload: CreatePrPayload) {
  return post<CreatePrResponse>("/github/create-pr", payload);
}
