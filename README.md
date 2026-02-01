# AgentOps

AgentOps is a small, end-to-end system for running AI agents against tasks, recording what happened, and turning the output into actionable artifacts (including GitHub PRs). The emphasis is on observability, explicit user control, and a clean architecture that is easy to explain in interviews.

## Who this is for
- Engineers who want a realistic, inspectable agent workflow without heavy infra.
- Hiring managers who want to see applied systems design, not just toy demos.
- Anyone looking for a compact example of product thinking + backend discipline.

## What problem it solves
Agent runs are often a black box. AgentOps makes each step explicit: inputs, outputs, logs, durations, and failures. It also shows how to safely add code context and optionally publish the result as a GitHub PR.

## Key features
- Single-agent execution with persisted runs and logs
- Planner -> Coder -> Reviewer workflow with per-step runs
- Metrics dashboard (rates, durations, runs by agent/status)
- Workspace context: explicit file selection and audit trail
- GitHub PR creation from agent output (user-mapped files)

## Architecture (quick view)

```
+-------------------+          +------------------+
|   React UI        | <------> |  Express API     |
|  (Vite + TS)      |          |  (Node + TS)     |
+-------------------+          +--------+---------+
                                       |
                                       v
                               +---------------+
                               |   Postgres    |
                               | (Prisma ORM)  |
                               +---------------+

Optional integrations:
- Workspace context (read-only files under WORKSPACE_ROOT)
- GitHub PR creation via PAT
```

## Quickstart
Prereqs: pnpm, Docker.

```bash
pnpm install
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
cd infra && docker compose up -d
pnpm -C backend db:migrate
pnpm dev
```

Open:
- http://localhost:5173
- http://localhost:4000/health

## Demo walkthrough (5 minutes)
1. Create 3 agents: Planner, Coder, Reviewer.
2. Create a task.
3. Run the workflow from the task detail view.
4. Open the Metrics page to see runs and durations.
5. (Optional) Select workspace files and re-run with context.
6. (Optional) Create a GitHub PR from the run output.

See `docs/demo.md` for a narrated version.

## Tech stack and why
- Express + TypeScript: small surface area and easy to reason about.
- Prisma + Postgres: clean data model and migrations without vendor lock-in.
- React + Vite: fast local dev and a simple UI.
- No queues or workers: sequential execution is easier to inspect.

## Environment variables
Backend (`backend/.env`):
- DATABASE_URL
- LLM_API_KEY
- LLM_BASE_URL (optional)
- WORKSPACE_ROOT
- GITHUB_TOKEN (optional, enables PR creation)

Frontend (`frontend/.env`):
- VITE_API_BASE_URL

## Sample data (quick seed)
Use the UI or run these once:

```bash
curl -X POST http://localhost:4000/api/agents \
  -H "Content-Type: application/json" \
  -d '{"name":"Planner","role":"Planner","systemPrompt":"Create a clear plan."}'

curl -X POST http://localhost:4000/api/agents \
  -H "Content-Type: application/json" \
  -d '{"name":"Coder","role":"Coder","systemPrompt":"Implement the plan."}'

curl -X POST http://localhost:4000/api/agents \
  -H "Content-Type: application/json" \
  -d '{"name":"Reviewer","role":"Reviewer","systemPrompt":"Review the solution."}'

curl -X POST http://localhost:4000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Add a health endpoint","description":"Return { ok: true } from /health"}'
```

## Future improvements (intentionally scoped)
- Background jobs and retries
- Real diff and patch support
- Auth + multi-tenant orgs
- Streaming token output

## Documentation
- docs/architecture.md
- docs/decisions.md
- docs/demo.md

## License
MIT
