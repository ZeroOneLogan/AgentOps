type GitHubRepo = {
  id: number;
  name: string;
  full_name: string;
  default_branch: string;
  owner: { login: string };
  private: boolean;
};

type GitRefResponse = {
  object: { sha: string };
};

type CreateRefResponse = {
  ref: string;
  object: { sha: string };
};

type CreatePrResponse = {
  html_url: string;
};

const API_BASE = "https://api.github.com";

function getToken() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN is not configured");
  }
  return token;
}

async function request<T>(path: string, options: RequestInit = {}) {
  const token = getToken();
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {})
    }
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.message || `GitHub request failed: ${response.status}`;
    throw new Error(message);
  }
  return payload as T;
}

export async function listRepos() {
  const repos: GitHubRepo[] = [];
  let page = 1;
  while (page <= 3) {
    const batch = await request<GitHubRepo[]>(`/user/repos?per_page=100&page=${page}`);
    repos.push(...batch);
    if (batch.length < 100) break;
    page += 1;
  }
  return repos.map((repo) => ({
    id: repo.id,
    name: repo.name,
    full_name: repo.full_name,
    owner: repo.owner.login,
    default_branch: repo.default_branch,
    private: repo.private
  }));
}

export async function getBranchSha(owner: string, repo: string, branch: string) {
  const ref = await request<GitRefResponse>(`/repos/${owner}/${repo}/git/ref/heads/${branch}`);
  return ref.object.sha;
}

export async function createBranch(owner: string, repo: string, branch: string, sha: string) {
  const body = { ref: `refs/heads/${branch}`, sha };
  return request<CreateRefResponse>(`/repos/${owner}/${repo}/git/refs`, {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export async function upsertFile(
  owner: string,
  repo: string,
  branch: string,
  filePath: string,
  content: string,
  message: string
) {
  const body = {
    message,
    content: Buffer.from(content).toString("base64"),
    branch
  };
  return request(`/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath)}`, {
    method: "PUT",
    body: JSON.stringify(body)
  });
}

export async function createPullRequest(
  owner: string,
  repo: string,
  base: string,
  head: string,
  title: string,
  body: string
) {
  const payload = await request<CreatePrResponse>(`/repos/${owner}/${repo}/pulls`, {
    method: "POST",
    body: JSON.stringify({ title, body, base, head })
  });
  return payload.html_url;
}
