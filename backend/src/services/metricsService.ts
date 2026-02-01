import { prisma } from "../lib/db";

function toDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date format");
  }
  return date;
}

function defaultRange(days: number) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days + 1);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export async function getOverviewMetrics() {
  const totalRuns = await prisma.run.count();
  const successRuns = await prisma.run.count({ where: { status: "succeeded" } });
  const failedRuns = await prisma.run.count({ where: { status: "failed" } });

  const avgRunDuration = await prisma.$queryRaw<
    Array<{ avg_duration_ms: number | null }>
  >`
    SELECT AVG(EXTRACT(EPOCH FROM (ended_at - started_at)) * 1000)::float as avg_duration_ms
    FROM runs
    WHERE started_at IS NOT NULL AND ended_at IS NOT NULL
  `;

  const avgWorkflowDuration = await prisma.$queryRaw<
    Array<{ avg_duration_ms: number | null }>
  >`
    SELECT AVG(duration_ms)::float as avg_duration_ms
    FROM (
      SELECT
        EXTRACT(EPOCH FROM (MAX(ended_at) - MIN(started_at))) * 1000 as duration_ms
      FROM runs
      WHERE input->>'workflow_id' IS NOT NULL
        AND started_at IS NOT NULL
        AND ended_at IS NOT NULL
      GROUP BY input->>'workflow_id'
    ) workflow_durations
  `;

  const successRate = totalRuns === 0 ? 0 : successRuns / totalRuns;
  const failureRate = totalRuns === 0 ? 0 : failedRuns / totalRuns;

  return {
    total_runs: totalRuns,
    success_rate: Number(successRate.toFixed(3)),
    failure_rate: Number(failureRate.toFixed(3)),
    avg_run_duration_ms: Math.round(avgRunDuration[0]?.avg_duration_ms || 0),
    avg_workflow_duration_ms: Math.round(avgWorkflowDuration[0]?.avg_duration_ms || 0)
  };
}

export async function getRunsByDay(from?: string, to?: string) {
  const range = from && to ? { start: toDate(from), end: toDate(to) } : defaultRange(14);

  const rows = await prisma.$queryRaw<
    Array<{ day: Date; run_count: number }>
  >`
    SELECT date_trunc('day', created_at) as day, COUNT(*)::int as run_count
    FROM runs
    WHERE created_at BETWEEN ${range.start} AND ${range.end}
    GROUP BY day
    ORDER BY day ASC
  `;

  return rows.map((row) => ({
    day: row.day.toISOString().slice(0, 10),
    run_count: row.run_count
  }));
}

export async function getRunsByStatus(from?: string, to?: string) {
  const range = from && to ? { start: toDate(from), end: toDate(to) } : defaultRange(14);

  const rows = await prisma.$queryRaw<
    Array<{ status: string; run_count: number }>
  >`
    SELECT status, COUNT(*)::int as run_count
    FROM runs
    WHERE created_at BETWEEN ${range.start} AND ${range.end}
    GROUP BY status
    ORDER BY status ASC
  `;

  return rows.map((row) => ({
    status: row.status,
    run_count: row.run_count
  }));
}

export async function getAgentMetrics() {
  const rows = await prisma.$queryRaw<
    Array<{
      agent_id: string;
      agent_name: string;
      run_count: number;
      success_count: number;
      avg_duration_ms: number | null;
    }>
  >`
    SELECT
      agents.id as agent_id,
      agents.name as agent_name,
      COUNT(runs.id)::int as run_count,
      SUM(CASE WHEN runs.status = 'succeeded' THEN 1 ELSE 0 END)::int as success_count,
      AVG(EXTRACT(EPOCH FROM (runs.ended_at - runs.started_at)) * 1000)::float as avg_duration_ms
    FROM agents
    LEFT JOIN runs ON runs.agent_id = agents.id
    GROUP BY agents.id
    ORDER BY run_count DESC, agents.name ASC
  `;

  return rows.map((row) => ({
    agent_id: row.agent_id,
    agent_name: row.agent_name,
    run_count: row.run_count,
    success_rate: row.run_count === 0 ? 0 : Number((row.success_count / row.run_count).toFixed(3)),
    avg_duration_ms: Math.round(row.avg_duration_ms || 0)
  }));
}
