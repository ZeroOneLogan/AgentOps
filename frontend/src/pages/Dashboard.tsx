import { useEffect, useState } from "react";
import { listAgents } from "../lib/api/agents";
import { listTasks } from "../lib/api/tasks";
import type { Agent, Task } from "../lib/types";
import { formatDate } from "../lib/ui/format";
import { ErrorState, LoadingState } from "../components/Status";
import Button from "../components/Button";
import { Link } from "react-router-dom";

type DashboardState = {
  agents: Agent[];
  tasks: Task[];
};

export default function Dashboard() {
  const [data, setData] = useState<DashboardState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setError(null);
      const [agents, tasks] = await Promise.all([listAgents(100, 0), listTasks(100, 0)]);
      setData({ agents: agents.data, tasks: tasks.data });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (error) {
    return <ErrorState title="Dashboard failed" message={error} actionLabel="Retry" onAction={load} />;
  }

  if (!data) {
    return <LoadingState title="Loading dashboard" />;
  }

  const recentTasks = [...data.tasks].slice(0, 5);

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Overview</p>
          <h1>AgentOps Dashboard</h1>
          <p className="page-subtitle">
            A minimal operational view into agents, tasks, and execution runs.
          </p>
        </div>
        <div className="page-actions">
          <Link to="/agents">
            <Button variant="primary">Manage Agents</Button>
          </Link>
          <Link to="/tasks">
            <Button variant="secondary">Manage Tasks</Button>
          </Link>
        </div>
      </div>

      <div className="stats-grid">
        <div className="card">
          <p className="card__label">Agents</p>
          <h2>{data.agents.length}</h2>
          <p className="card__meta">Registered in the system.</p>
        </div>
        <div className="card">
          <p className="card__label">Tasks</p>
          <h2>{data.tasks.length}</h2>
          <p className="card__meta">Defined workflows and jobs.</p>
        </div>
        <div className="card">
          <p className="card__label">Runs</p>
          <h2>—</h2>
          <p className="card__meta">Available in task detail view.</p>
        </div>
      </div>

      <div className="section">
        <div className="section__header">
          <h3>Recent tasks</h3>
          <Link to="/tasks" className="link">
            View all
          </Link>
        </div>
        {recentTasks.length === 0 ? (
          <div className="empty">No tasks yet.</div>
        ) : (
          <div className="table">
            <div className="table__row table__row--head">
              <div>Title</div>
              <div>Status</div>
              <div>Updated</div>
            </div>
            {recentTasks.map((task) => (
              <div key={task.id} className="table__row">
                <div>{task.title}</div>
                <div className={`badge badge--${task.status}`}>{task.status}</div>
                <div>{formatDate(task.updatedAt)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
