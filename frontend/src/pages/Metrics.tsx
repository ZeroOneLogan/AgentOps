import { useEffect, useMemo, useState } from "react";
import { ErrorState, LoadingState } from "../components/Status";
import { formatDate } from "../lib/ui/format";
import {
  getAgentMetrics,
  getOverview,
  getRunsByDay,
  getRunsByStatus,
  type AgentMetric,
  type OverviewMetrics,
  type RunsByDay,
  type RunsByStatus
} from "../lib/api/metrics";

function formatDuration(ms: number) {
  if (!ms) return "—";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  return `${minutes}m`;
}

function ratePercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function BarChart({ data }: { data: RunsByDay[] }) {
  const max = Math.max(1, ...data.map((item) => item.run_count));
  return (
    <div className="chart">
      <div className="chart__bars">
        {data.map((item) => {
          const height = Math.round((item.run_count / max) * 100);
          return (
            <div key={item.day} className="chart__bar">
              <div className="chart__bar-fill" style={{ height: `${height}%` }} />
              <span className="chart__bar-label">{item.run_count}</span>
            </div>
          );
        })}
      </div>
      <div className="chart__axis">
        {data.map((item) => (
          <span key={item.day}>{item.day.slice(5)}</span>
        ))}
      </div>
    </div>
  );
}

function StatusBreakdown({ data }: { data: RunsByStatus[] }) {
  const total = data.reduce((sum, item) => sum + item.run_count, 0) || 1;
  return (
    <div className="status-grid">
      {data.map((item) => (
        <div key={item.status} className="status-card">
          <p className="card__label">{item.status}</p>
          <h3>{item.run_count}</h3>
          <p className="card__meta">{ratePercent(item.run_count / total)}</p>
        </div>
      ))}
    </div>
  );
}

export default function Metrics() {
  const [overview, setOverview] = useState<OverviewMetrics | null>(null);
  const [runsByDay, setRunsByDay] = useState<RunsByDay[]>([]);
  const [runsByStatus, setRunsByStatus] = useState<RunsByStatus[]>([]);
  const [agents, setAgents] = useState<AgentMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const [overviewData, runsDayData, runsStatusData, agentData] = await Promise.all([
        getOverview(),
        getRunsByDay(),
        getRunsByStatus(),
        getAgentMetrics()
      ]);
      setOverview(overviewData);
      setRunsByDay(runsDayData.data);
      setRunsByStatus(runsStatusData.data);
      setAgents(agentData.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load metrics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const lastUpdated = useMemo(() => formatDate(new Date().toISOString()), []);

  if (loading) {
    return <LoadingState title="Loading metrics" />;
  }

  if (error) {
    return <ErrorState title="Metrics failed" message={error} actionLabel="Retry" onAction={load} />;
  }

  if (!overview) {
    return <ErrorState title="Metrics unavailable" message="No metrics found." actionLabel="Retry" onAction={load} />;
  }

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Observability</p>
          <h1>Metrics & reliability</h1>
          <p className="page-subtitle">Last updated {lastUpdated}. Metrics are derived from runs and logs.</p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="card">
          <p className="card__label">Total runs</p>
          <h2>{overview.total_runs}</h2>
          <p className="card__meta">Across all tasks.</p>
        </div>
        <div className="card">
          <p className="card__label">Success rate</p>
          <h2>{ratePercent(overview.success_rate)}</h2>
          <p className="card__meta">Failures: {ratePercent(overview.failure_rate)}</p>
        </div>
        <div className="card">
          <p className="card__label">Avg run duration</p>
          <h2>{formatDuration(overview.avg_run_duration_ms)}</h2>
          <p className="card__meta">Single runs only.</p>
        </div>
        <div className="card">
          <p className="card__label">Avg workflow duration</p>
          <h2>{formatDuration(overview.avg_workflow_duration_ms)}</h2>
          <p className="card__meta">Planner → Coder → Reviewer.</p>
        </div>
      </div>

      <div className="section">
        <div className="section__header">
          <h3>Runs over time (last 14 days)</h3>
        </div>
        {runsByDay.length === 0 ? (
          <div className="empty">No run data yet.</div>
        ) : (
          <BarChart data={runsByDay} />
        )}
      </div>

      <div className="section">
        <div className="section__header">
          <h3>Runs by status</h3>
        </div>
        {runsByStatus.length === 0 ? <div className="empty">No run data yet.</div> : <StatusBreakdown data={runsByStatus} />}
      </div>

      <div className="section">
        <div className="section__header">
          <h3>Runs by agent</h3>
        </div>
        {agents.length === 0 ? (
          <div className="empty">No agents yet.</div>
        ) : (
          <div className="table">
            <div className="table__row table__row--head">
              <div>Agent</div>
              <div>Runs</div>
              <div>Success</div>
              <div>Avg duration</div>
            </div>
            {agents.map((agent) => (
              <div key={agent.agent_id} className="table__row">
                <div>
                  <p className="table__title">{agent.agent_name}</p>
                  <p className="table__meta">{agent.agent_id}</p>
                </div>
                <div>{agent.run_count}</div>
                <div>{ratePercent(agent.success_rate)}</div>
                <div>{formatDuration(agent.avg_duration_ms)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
