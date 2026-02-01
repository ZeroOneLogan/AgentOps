import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Button from "../components/Button";
import Select from "../components/Select";
import { EmptyState, ErrorState, LoadingState } from "../components/Status";
import { listAgents } from "../lib/api/agents";
import { getRunLogs, listRunsForTask, getTask } from "../lib/api/tasks";
import { executeRun, executeWorkflow } from "../lib/api/runs";
import { getWorkspaceFile, getWorkspaceTree, listWorkspaces } from "../lib/api/workspaces";
import { createPullRequest, listRepos } from "../lib/api/github";
import type { Agent, Run, RunLog, Task } from "../lib/types";
import type { Workspace, WorkspaceFile, WorkspaceLimits } from "../lib/api/workspaces";
import { formatDate } from "../lib/ui/format";

type LogState = {
  loading: boolean;
  error?: string;
  logs?: RunLog[];
};

type FileContentState = {
  loading: boolean;
  error?: string;
  content?: string;
};

function extractOutput(value: unknown) {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value && "text" in value) {
    const text = (value as { text?: string }).text;
    return text || null;
  }
  return JSON.stringify(value, null, 2);
}

function getStepMeta(run: Run) {
  if (run.input && typeof run.input === "object") {
    const input = run.input as {
      workflow_step_name?: string;
      workflow_step_index?: number;
      workflow_id?: string;
      workspace_name?: string;
      context_files?: Array<{ path: string; size_bytes: number; language: string }>;
      total_context_bytes?: number;
    };
    return input;
  }
  return {};
}

function formatDuration(start?: string | null, end?: string | null) {
  if (!start || !end) return "—";
  const durationMs = new Date(end).getTime() - new Date(start).getTime();
  if (Number.isNaN(durationMs)) return "—";
  return `${Math.max(0, Math.round(durationMs / 1000))}s`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function TaskDetail() {
  const params = useParams();
  const taskId = params.id || "";
  const [task, setTask] = useState<Task | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [plannerId, setPlannerId] = useState<string>("");
  const [coderId, setCoderId] = useState<string>("");
  const [reviewerId, setReviewerId] = useState<string>("");
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceName, setWorkspaceName] = useState<string>("");
  const [workspaceFiles, setWorkspaceFiles] = useState<WorkspaceFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [limits, setLimits] = useState<WorkspaceLimits | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logState, setLogState] = useState<Record<string, LogState>>({});
  const [logFilters, setLogFilters] = useState<Record<string, string>>({});
  const [executing, setExecuting] = useState(false);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [workflowRunning, setWorkflowRunning] = useState(false);
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [fileContents, setFileContents] = useState<Record<string, FileContentState>>({});
  const [prOpen, setPrOpen] = useState(false);
  const [repos, setRepos] = useState<Array<{ owner: string; name: string; full_name: string; default_branch: string }>>(
    []
  );
  const [repoSelection, setRepoSelection] = useState<string>("");
  const [baseBranch, setBaseBranch] = useState<string>("main");
  const [branchName, setBranchName] = useState<string>("");
  const [commitMessage, setCommitMessage] = useState<string>("AgentOps update");
  const [prTitle, setPrTitle] = useState<string>("");
  const [prBody, setPrBody] = useState<string>("");
  const [fileMappings, setFileMappings] = useState<Array<{ path: string; content: string }>>([]);
  const [prLoading, setPrLoading] = useState(false);
  const [prError, setPrError] = useState<string | null>(null);
  const [prSuccessUrl, setPrSuccessUrl] = useState<string | null>(null);
  const [prRunId, setPrRunId] = useState<string>("");

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const [taskResponse, runsResponse, agentsResponse, workspaceResponse] = await Promise.all([
        getTask(taskId),
        listRunsForTask(taskId, 100, 0),
        listAgents(100, 0),
        listWorkspaces()
      ]);
      setTask(taskResponse);
      setRuns(runsResponse.data);
      setAgents(agentsResponse.data);
      setWorkspaces(workspaceResponse.data);
      setLimits(workspaceResponse.limits);
      if (!selectedAgentId && agentsResponse.data.length > 0) {
        setSelectedAgentId(agentsResponse.data[0].id);
      }
      if (!plannerId && agentsResponse.data.length > 0) {
        const [first, second, third] = agentsResponse.data;
        setPlannerId(first?.id || "");
        setCoderId(second?.id || first?.id || "");
        setReviewerId(third?.id || second?.id || first?.id || "");
      }
      if (!workspaceName && workspaceResponse.data.length > 0) {
        setWorkspaceName(workspaceResponse.data[0].name);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load task detail");
    } finally {
      setLoading(false);
    }
  };

  const loadWorkspaceTree = async (name: string) => {
    if (!name) return;
    try {
      const response = await getWorkspaceTree(name);
      setWorkspaceFiles(response.data);
      setLimits(response.limits);
      setSelectedFiles(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workspace tree");
    }
  };

  useEffect(() => {
    if (taskId) {
      load();
    }
  }, [taskId]);

  useEffect(() => {
    if (workspaceName) {
      loadWorkspaceTree(workspaceName);
    }
  }, [workspaceName]);

  const toggleLogs = async (runId: string) => {
    const existing = logState[runId];
    if (existing?.logs) {
      setLogState((prev) => ({ ...prev, [runId]: { ...existing, logs: undefined } }));
      return;
    }

    setLogState((prev) => ({ ...prev, [runId]: { loading: true } }));
    try {
      const response = await getRunLogs(runId, 100, 0);
      setLogState((prev) => ({
        ...prev,
        [runId]: { loading: false, logs: response.data }
      }));
    } catch (err) {
      setLogState((prev) => ({
        ...prev,
        [runId]: { loading: false, error: err instanceof Error ? err.message : "Failed to load logs" }
      }));
    }
  };

  const updateLogFilter = (runId: string, value: string) => {
    setLogFilters((prev) => ({ ...prev, [runId]: value }));
  };

  const toggleFile = (path: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const selectedFileList = useMemo(
    () => workspaceFiles.filter((file) => selectedFiles.has(file.path)),
    [workspaceFiles, selectedFiles]
  );

  const totalContextBytes = useMemo(
    () => selectedFileList.reduce((sum, file) => sum + file.size_bytes, 0),
    [selectedFileList]
  );

  const maxTotalBytes = limits?.MAX_TOTAL_BYTES || 0;
  const warnThreshold = maxTotalBytes ? Math.round(maxTotalBytes * 0.8) : 0;
  const exceedsLimit = maxTotalBytes > 0 && totalContextBytes > maxTotalBytes;

  const handleExecute = async () => {
    if (!taskId || !selectedAgentId) return;
    if (exceedsLimit) {
      setExecutionError("Context size exceeds limit. Remove files to continue.");
      return;
    }
    try {
      setExecuting(true);
      setExecutionError(null);
      const payload = {
        task_id: taskId,
        agent_id: selectedAgentId,
        workspace_name: selectedFileList.length > 0 ? workspaceName : undefined,
        context_files: selectedFileList.length > 0 ? selectedFileList.map((file) => file.path) : undefined
      };
      const response = await executeRun(payload);
      const now = new Date().toISOString();
      setRuns((prev) => [
        {
          id: response.run_id,
          taskId,
          agentId: selectedAgentId,
          status: response.status,
          createdAt: now,
          updatedAt: now,
          input: {
            workspace_name: payload.workspace_name,
            context_files: selectedFileList,
            total_context_bytes: totalContextBytes
          }
        },
        ...prev
      ]);
      setTimeout(() => {
        void load();
      }, 1500);
    } catch (err) {
      setExecutionError(err instanceof Error ? err.message : "Execution failed");
    } finally {
      setExecuting(false);
    }
  };

  const workflowSelectionValid =
    plannerId &&
    coderId &&
    reviewerId &&
    new Set([plannerId, coderId, reviewerId]).size === 3;

  const handleWorkflowExecute = async () => {
    if (!workflowSelectionValid || !taskId) return;
    if (exceedsLimit) {
      setWorkflowError("Context size exceeds limit. Remove files to continue.");
      return;
    }
    try {
      setWorkflowRunning(true);
      setWorkflowError(null);
      const payload = {
        task_id: taskId,
        agent_ids: [plannerId, coderId, reviewerId],
        workspace_name: selectedFileList.length > 0 ? workspaceName : undefined,
        context_files: selectedFileList.length > 0 ? selectedFileList.map((file) => file.path) : undefined
      };
      const response = await executeWorkflow(payload);
      const now = new Date().toISOString();
      const [plannerRunId, coderRunId, reviewerRunId] = response.runs || [];
      const contextMeta = {
        workspace_name: payload.workspace_name,
        context_files: selectedFileList,
        total_context_bytes: totalContextBytes
      };
      setRuns((prev) => [
        {
          id: reviewerRunId,
          taskId,
          agentId: reviewerId,
          status: "queued",
          createdAt: now,
          updatedAt: now,
          input: {
            workflow_id: response.workflow_run_id,
            workflow_step_name: "Reviewer",
            workflow_step_index: 2,
            ...contextMeta
          }
        },
        {
          id: coderRunId,
          taskId,
          agentId: coderId,
          status: "queued",
          createdAt: now,
          updatedAt: now,
          input: {
            workflow_id: response.workflow_run_id,
            workflow_step_name: "Coder",
            workflow_step_index: 1,
            ...contextMeta
          }
        },
        {
          id: plannerRunId,
          taskId,
          agentId: plannerId,
          status: "queued",
          createdAt: now,
          updatedAt: now,
          input: {
            workflow_id: response.workflow_run_id,
            workflow_step_name: "Planner",
            workflow_step_index: 0,
            ...contextMeta
          }
        },
        ...prev
      ]);
      setTimeout(() => void load(), 2000);
    } catch (err) {
      setWorkflowError(err instanceof Error ? err.message : "Workflow execution failed");
    } finally {
      setWorkflowRunning(false);
    }
  };

  const openFile = async (workspace: string, path: string, key: string) => {
    if (fileContents[key]?.content) {
      setFileContents((prev) => ({ ...prev, [key]: { ...prev[key], content: undefined } }));
      return;
    }
    setFileContents((prev) => ({ ...prev, [key]: { loading: true } }));
    try {
      const file = await getWorkspaceFile(workspace, path);
      setFileContents((prev) => ({
        ...prev,
        [key]: { loading: false, content: file.content }
      }));
    } catch (err) {
      setFileContents((prev) => ({
        ...prev,
        [key]: { loading: false, error: err instanceof Error ? err.message : "Failed to load file" }
      }));
    }
  };

  const openPrModal = async (run: Run) => {
    const outputText = extractOutput(run.output) || "";
    setPrOpen(true);
    setPrError(null);
    setPrSuccessUrl(null);
    setPrRunId(run.id);
    setFileMappings([{ path: "", content: outputText }]);
    setPrTitle(`AgentOps: ${task?.title || "Update"}`);
    setPrBody(`Automated PR created from AgentOps run ${run.id}.`);
    setBranchName(`agentops/${run.id.slice(0, 8)}`);
    try {
      const response = await listRepos();
      const data = response.data.map((repo) => ({
        owner: repo.owner,
        name: repo.name,
        full_name: repo.full_name,
        default_branch: repo.default_branch
      }));
      setRepos(data);
      if (data.length > 0) {
        setRepoSelection(data[0].full_name);
        setBaseBranch(data[0].default_branch || "main");
      }
    } catch (err) {
      setPrError(err instanceof Error ? err.message : "Failed to load repositories");
    }
  };

  const updateFileMapping = (index: number, field: "path" | "content", value: string) => {
    setFileMappings((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item))
    );
  };

  const addFileMapping = () => {
    setFileMappings((prev) => [...prev, { path: "", content: "" }]);
  };

  const removeFileMapping = (index: number) => {
    setFileMappings((prev) => prev.filter((_, idx) => idx !== index));
  };

  const submitPr = async (runId: string) => {
    setPrLoading(true);
    setPrError(null);
    try {
      const [owner, repo] = repoSelection.split("/");
      const files = fileMappings.filter((file) => file.path.trim().length > 0);
      if (!owner || !repo || files.length === 0) {
        throw new Error("Repository and at least one file are required");
      }
      const response = await createPullRequest({
        run_id: runId,
        repo_owner: owner,
        repo_name: repo,
        base_branch: baseBranch || "main",
        branch_name: branchName,
        commit_message: commitMessage,
        pr_title: prTitle,
        pr_body: prBody,
        files
      });
      setPrSuccessUrl(response.pull_request_url);
    } catch (err) {
      setPrError(err instanceof Error ? err.message : "PR creation failed");
    } finally {
      setPrLoading(false);
    }
  };

  const empty = useMemo(() => runs.length === 0, [runs.length]);

  if (loading) {
    return <LoadingState title="Loading task" />;
  }

  if (error || !task) {
    return (
      <ErrorState
        title="Task detail failed"
        message={error || "Task not found"}
        actionLabel="Retry"
        onAction={load}
      />
    );
  }

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Task detail</p>
          <h1>{task.title}</h1>
          <p className="page-subtitle">{task.description || "No description."}</p>
        </div>
        <div className="page-actions">
          <Link to="/tasks">
            <Button variant="ghost">Back to Tasks</Button>
          </Link>
        </div>
      </div>

      <div className="detail-grid">
        <div className="card">
          <p className="card__label">Status</p>
          <h3 className={`badge badge--${task.status}`}>{task.status}</h3>
        </div>
        <div className="card">
          <p className="card__label">Created</p>
          <p>{formatDate(task.createdAt)}</p>
        </div>
        <div className="card">
          <p className="card__label">Updated</p>
          <p>{formatDate(task.updatedAt)}</p>
        </div>
      </div>

      <div className="section">
        <div className="section__header">
          <h3>Workspace context</h3>
        </div>
        <div className="workspace-panel">
          <Select
            label="Workspace"
            options={workspaces.map((workspace) => ({ value: workspace.name, label: workspace.name }))}
            value={workspaceName}
            onChange={(event) => setWorkspaceName(event.target.value)}
          />
          <div className="workspace-meta">
            <p className="card__label">Selected files</p>
            <p className="workspace-meta__value">{selectedFileList.length} files · {formatBytes(totalContextBytes)}</p>
            {limits ? (
              <p className="workspace-meta__hint">
                Limit {formatBytes(limits.MAX_TOTAL_BYTES)} total · {formatBytes(limits.MAX_FILE_BYTES)} per file
              </p>
            ) : null}
            {warnThreshold > 0 && totalContextBytes > warnThreshold ? (
              <p className="field__error">Approaching context limit. Consider removing files.</p>
            ) : null}
            {exceedsLimit ? <p className="field__error">Context size exceeds limit.</p> : null}
          </div>
        </div>
        {workspaceFiles.length === 0 ? (
          <div className="empty">No files available or workspace not selected.</div>
        ) : (
          <div className="table">
            <div className="table__row table__row--head">
              <div>File</div>
              <div>Language</div>
              <div>Size</div>
              <div className="table__actions">Include</div>
            </div>
            {workspaceFiles.map((file) => (
              <div key={file.path} className="table__row">
                <div className="table__title">{file.path}</div>
                <div>{file.language}</div>
                <div>{formatBytes(file.size_bytes)}</div>
                <div className="table__actions">
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={selectedFiles.has(file.path)}
                      onChange={() => toggleFile(file.path)}
                    />
                    <span>Include</span>
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="section">
        <div className="section__header">
          <h3>Execute with agent</h3>
        </div>
        <div className="execute-panel">
          <Select
            label="Agent"
            options={agents.map((agent) => ({ value: agent.id, label: `${agent.name} (${agent.role})` }))}
            value={selectedAgentId}
            onChange={(event) => setSelectedAgentId(event.target.value)}
          />
          <Button variant="primary" onClick={handleExecute} disabled={!selectedAgentId || executing || exceedsLimit}>
            {executing ? "Running…" : "Execute"}
          </Button>
          {executionError ? <p className="field__error">{executionError}</p> : null}
        </div>
      </div>

      <div className="section">
        <div className="section__header">
          <h3>Execute workflow</h3>
        </div>
        <div className="workflow-panel">
          <Select
            label="Planner"
            options={agents.map((agent) => ({ value: agent.id, label: `${agent.name} (${agent.role})` }))}
            value={plannerId}
            onChange={(event) => setPlannerId(event.target.value)}
          />
          <Select
            label="Coder"
            options={agents.map((agent) => ({ value: agent.id, label: `${agent.name} (${agent.role})` }))}
            value={coderId}
            onChange={(event) => setCoderId(event.target.value)}
          />
          <Select
            label="Reviewer"
            options={agents.map((agent) => ({ value: agent.id, label: `${agent.name} (${agent.role})` }))}
            value={reviewerId}
            onChange={(event) => setReviewerId(event.target.value)}
          />
          <Button
            variant="primary"
            onClick={handleWorkflowExecute}
            disabled={!workflowSelectionValid || workflowRunning || exceedsLimit}
          >
            {workflowRunning ? "Running workflow…" : "Execute Workflow"}
          </Button>
          {!workflowSelectionValid ? (
            <p className="field__error">Select three unique agents for the workflow.</p>
          ) : null}
          {workflowError ? <p className="field__error">{workflowError}</p> : null}
        </div>
      </div>

      <div className="section">
        <div className="section__header">
          <h3>Runs</h3>
          <span className="muted">{runs.length} total</span>
        </div>

        {empty ? (
          <EmptyState title="No runs yet" message="Runs will appear after an agent is queued." />
        ) : (
          <div className="table">
            <div className="table__row table__row--head">
              <div>Run</div>
              <div>Status</div>
              <div>Agent</div>
              <div>Created</div>
              <div className="table__actions">Details</div>
            </div>
            {[...runs]
              .sort((a, b) => {
                const aMeta = getStepMeta(a);
                const bMeta = getStepMeta(b);
                const aIndex = typeof aMeta.workflow_step_index === "number" ? aMeta.workflow_step_index : null;
                const bIndex = typeof bMeta.workflow_step_index === "number" ? bMeta.workflow_step_index : null;
                if (aIndex !== null && bIndex !== null && aIndex !== bIndex) {
                  return aIndex - bIndex;
                }
                return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
              })
              .map((run) => {
                const logs = logState[run.id];
                const isExpanded = Boolean(logs?.logs);
                const outputText = extractOutput(run.output);
                const stepMeta = getStepMeta(run);
                const agent = agents.find((item) => item.id === run.agentId);
                const activeFilter = logFilters[run.id] || "all";
                const filteredLogs = logs?.logs?.filter((log) =>
                  activeFilter === "all" ? true : log.level === activeFilter
                );
                const contextFiles = stepMeta.context_files || [];
                const workspace = stepMeta.workspace_name;
                return (
                  <div key={run.id} className="table__row table__row--expandable">
                    <div>
                      <p className="table__title">
                        {stepMeta.workflow_step_name ? `${stepMeta.workflow_step_name} step` : "Single run"}
                      </p>
                      <p className="table__meta">Task: {run.taskId}</p>
                    </div>
                    <div className={`badge badge--${run.status}`}>{run.status}</div>
                    <div className="table__meta">
                      {agent ? `${agent.name} (${agent.role})` : run.agentId}
                    </div>
                    <div>
                      {formatDate(run.createdAt)}
                      <span className="muted"> · {formatDuration(run.startedAt, run.endedAt)}</span>
                    </div>
                    <div className="table__actions">
                      <Button variant="ghost" onClick={() => toggleLogs(run.id)}>
                        {isExpanded ? "Hide logs" : "View logs"}
                      </Button>
                      <Button variant="secondary" onClick={() => openPrModal(run)}>
                        Create PR
                      </Button>
                    </div>
                    {contextFiles.length > 0 && workspace ? (
                      <div className="table__row table__row--nested">
                        <p className="status__title">Context files ({contextFiles.length})</p>
                        <div className="context-files">
                          {contextFiles.map((file) => {
                            const key = `${run.id}:${file.path}`;
                            const state = fileContents[key];
                            return (
                              <div key={file.path} className="context-file">
                                <div>
                                  <p className="table__title">{file.path}</p>
                                  <p className="table__meta">{formatBytes(file.size_bytes)}</p>
                                </div>
                                <Button
                                  variant="ghost"
                                  onClick={() => openFile(workspace, file.path, key)}
                                >
                                  {state?.content ? "Hide" : "View"}
                                </Button>
                                {state?.loading ? <LoadingState title="Loading file" /> : null}
                                {state?.error ? <ErrorState title="File error" message={state.error} /> : null}
                                {state?.content ? <pre className="output">{state.content}</pre> : null}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                    {run.error ? (
                      <div className="table__row table__row--nested">
                        <p className="status__title">Execution error</p>
                        <p className="status__message">{run.error}</p>
                      </div>
                    ) : null}
                    {outputText ? (
                      <div className="table__row table__row--nested">
                        <p className="status__title">Output</p>
                        <pre className="output">{outputText}</pre>
                      </div>
                    ) : null}
                    {isExpanded || logs?.loading || logs?.error ? (
                      <div className="table__row table__row--nested">
                        {logs?.loading ? (
                          <LoadingState title="Loading logs" />
                        ) : logs?.error ? (
                          <ErrorState title="Logs failed" message={logs.error} />
                        ) : logs?.logs && logs.logs.length > 0 ? (
                          <div className="log-list">
                            <div className="log-filter">
                              <label className="field__label" htmlFor={`log-filter-${run.id}`}>
                                Filter level
                              </label>
                              <select
                                id={`log-filter-${run.id}`}
                                className="field__input"
                                value={activeFilter}
                                onChange={(event) => updateLogFilter(run.id, event.target.value)}
                              >
                                <option value="all">All</option>
                                <option value="info">Info</option>
                                <option value="warn">Warn</option>
                                <option value="error">Error</option>
                              </select>
                            </div>
                            {(filteredLogs || []).map((log) => (
                              <div key={log.id} className="log-item">
                                <div className={`badge badge--${log.level}`}>{log.level}</div>
                                <div>
                                  <p>{log.message}</p>
                                  <p className="table__meta">{formatDate(log.createdAt)}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="empty">No logs for this run.</div>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {prOpen ? (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="modal__backdrop" onClick={() => setPrOpen(false)} aria-hidden="true" />
          <div className="modal__panel">
            <div className="modal__header">
              <h2>Create GitHub PR</h2>
              <button className="btn btn--ghost" type="button" onClick={() => setPrOpen(false)}>
                Close
              </button>
            </div>
            <div className="modal__body">
              <label className="field">
                <span className="field__label">Repository</span>
                <select
                  className="field__input"
                  value={repoSelection}
                  onChange={(event) => {
                    const next = event.target.value;
                    setRepoSelection(next);
                    const repoMeta = repos.find((repo) => repo.full_name === next);
                    if (repoMeta?.default_branch) setBaseBranch(repoMeta.default_branch);
                  }}
                >
                  {repos.map((repo) => (
                    <option key={repo.full_name} value={repo.full_name}>
                      {repo.full_name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="form-grid">
                <label className="field">
                  <span className="field__label">Base branch</span>
                  <input
                    className="field__input"
                    value={baseBranch}
                    onChange={(event) => setBaseBranch(event.target.value)}
                  />
                </label>
                <label className="field">
                  <span className="field__label">Feature branch</span>
                  <input
                    className="field__input"
                    value={branchName}
                    onChange={(event) => setBranchName(event.target.value)}
                  />
                </label>
              </div>
              <label className="field">
                <span className="field__label">Commit message</span>
                <input
                  className="field__input"
                  value={commitMessage}
                  onChange={(event) => setCommitMessage(event.target.value)}
                />
              </label>
              <label className="field">
                <span className="field__label">PR title</span>
                <input className="field__input" value={prTitle} onChange={(event) => setPrTitle(event.target.value)} />
              </label>
              <label className="field">
                <span className="field__label">PR description</span>
                <textarea
                  className="field__input field__input--textarea"
                  value={prBody}
                  onChange={(event) => setPrBody(event.target.value)}
                />
              </label>

              <div className="section">
                <div className="section__header">
                  <h3>Files to commit</h3>
                  <Button variant="ghost" onClick={addFileMapping}>
                    Add file
                  </Button>
                </div>
                {fileMappings.map((file, index) => (
                  <div key={`${file.path}-${index}`} className="file-mapping">
                    <label className="field">
                      <span className="field__label">File path</span>
                      <input
                        className="field__input"
                        value={file.path}
                        onChange={(event) => updateFileMapping(index, "path", event.target.value)}
                      />
                    </label>
                    <label className="field">
                      <span className="field__label">Content</span>
                      <textarea
                        className="field__input field__input--textarea"
                        value={file.content}
                        onChange={(event) => updateFileMapping(index, "content", event.target.value)}
                      />
                    </label>
                    <Button variant="danger" onClick={() => removeFileMapping(index)}>
                      Remove
                    </Button>
                  </div>
                ))}
              </div>

              {prError ? <p className="field__error">{prError}</p> : null}
              {prSuccessUrl ? (
                <p className="status__message">
                  PR created:{" "}
                  <a href={prSuccessUrl} target="_blank" rel="noreferrer">
                    {prSuccessUrl}
                  </a>
                </p>
              ) : null}
            </div>
            <div className="modal__footer">
              <Button variant="ghost" onClick={() => setPrOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => submitPr(prRunId)}
                disabled={prLoading || !prRunId}
              >
                {prLoading ? "Creating PR…" : "Create PR"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
