# architecture

## system overview
AgentOps has three core pieces:
- frontend (React + Vite) for running tasks and inspecting results
- backend (Express + TypeScript) for execution, logging, and metrics
- postgres (via Prisma) for persistence

Integrations are optional and explicit:
- workspace context: read-only files under WORKSPACE_ROOT
- GitHub PR creation: PAT via GITHUB_TOKEN

## execution model
Two execution modes:
1. single-agent run
2. sequential workflow: Planner -> Coder -> Reviewer

Each step is its own run with its own logs. The system favors clarity over throughput.

## observability model
Metrics come from existing tables:
- runs per day from run.created_at
- success/failure from run.status
- duration from started_at and ended_at
- workflow duration from runs grouped by workflow_id
- agent metrics from runs grouped by agent_id

## why no queues
No queues keeps the system deterministic and easy to debug. The tradeoff is throughput. That is intentional for a local demo and interview-friendly codebase.

## data flow (text diagram)

Task -> Run record -> LLM call -> Output + Logs -> Metrics

For workflows:
Task -> Run(Planner) -> Run(Coder) -> Run(Reviewer)

Workspace context, if enabled, is injected into the prompt and stored in run metadata.
