# demo guide

Use this during interviews. It is short, deterministic, and shows real engineering judgment.

## setup (3-5 minutes)
1. Start services:
   - pnpm install
   - cp backend/.env.example backend/.env
   - cp frontend/.env.example frontend/.env
   - cd infra && docker compose up -d
   - pnpm -C backend db:migrate
   - pnpm dev
2. Open the UI at http://localhost:5173

## seed data
Create three agents (Planner, Coder, Reviewer) and one task. Use the UI or curl from README.

## live walkthrough (5 minutes)
1. Agents page: show that agents are explicit and editable.
2. Tasks page: create a task.
3. Task detail: run the workflow. Show the timeline and logs.
4. Metrics page: show run counts and durations.
5. (Optional) Workspace context: select a few files and re-run.
6. (Optional) GitHub PR: map output to a file and create a PR.

## suggested narration
- "This is a small system, but every step is inspectable."
- "Each agent step is its own run with its own logs."
- "We avoid queues for clarity. It is deliberate tradeoff."
- "Context is explicit and auditable. No magic ingestion."
- "PR creation is manual and reversible."

## common questions
- Why no queues? -> Keep the system deterministic and easy to reason about.
- How do you scale? -> Add workers, retry strategy, and pre-aggregated metrics.
- How do you avoid prompt injection? -> Only user-selected files, strict root, allowlist.

## talking points
- Simple data model that supports execution and observability
- Intentional scope and explicit tradeoffs
- Clear boundaries between UI, API, and integrations
