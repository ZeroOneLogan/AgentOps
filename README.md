# AgentOps — Reliability Lab

**Inspect a failed AI coding attempt, test a correction, and keep the evidence.**

The first investigation is a free-shipping regression: a candidate checks the $50 threshold before applying a discount. A separate process executes the candidate, and a host-side evaluator compares its results against a fixed acceptance suite. The baseline passes 5 of 7 checks; the corrected demonstration fixture passes all 7.

Execution and correctness are separate outcomes. A successful model response can still fail verification.

## Try the no-key demo

Requires Node.js 22+ and pnpm 9.12.0. No database, Docker, or model credentials are needed for this path.

```bash
pnpm install
pnpm demo
```

Open http://localhost:5173. Select **Run baseline investigation**, inspect the two failed checks, then **Try corrected instructions**. Explore the code, exact inputs, execution timeline, and before/after results. Refresh the page or export the evidence as JSON.

**Fixture mode uses authored examples, not recorded or live model responses.** The regression checks really run in a separate Node process. Only the two exact bundled source strings are allowed through this local execution path. Evidence is stored in `backend/.demo-data/` (ignored by Git). The demo API exposes only investigation endpoints and binds to loopback.

## What is implemented

- A responsive investigation workspace with saved, addressable attempts.
- Separate execution and verification statuses, including unavailable verification.
- Seven explicit regression cases, executed independently of generation.
- Original and corrected candidates with parent lineage and unchanged original evidence.
- Persisted prompts, model/usage metadata where available, code and suite hashes, check results, and event timestamps.
- Live generation behind an explicit server setting; generated code executes only through Docker.
- Restart detection that marks unfinished investigations interrupted without silently reissuing external calls.
- A local fixture store and a PostgreSQL store behind the same interface.
- Existing agent/task CRUD, sequential workflows, metrics, workspace context, and GitHub PR tools remain available in the full application.

## Full application and live generation

Requires PostgreSQL and, for live candidate verification, a local Docker daemon. The application remains a **single-process local development tool without authentication**. Do not expose its API publicly.

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# Set DATABASE_URL and WORKSPACE_ROOT in backend/.env.
docker compose -f infra/docker-compose.yml up -d
pnpm -C backend exec prisma migrate deploy
pnpm dev
```

For live investigations, configure `LLM_API_KEY` and set `ENABLE_LIVE_INVESTIGATIONS=true` in `backend/.env`. `INVESTIGATION_MODEL` selects the model; `LLM_BASE_URL` optionally selects a compatible provider. Live generation uses API credits and results are not guaranteed to match the fixture walkthrough.

Pre-pull the verifier image explicitly:

```bash
docker pull node:22-alpine
```

`VERIFIER_IMAGE` defaults to `node:22-alpine`; use a vetted digest-pinned image when reproducible infrastructure matters. The verifier never auto-pulls an image. It runs with no network, a read-only filesystem and input mount, no Linux capabilities, an unprivileged user, resource limits, and a wall-clock deadline. The temporary directory contains only the candidate and harness. No API keys or workspace files are passed into the container.

If Docker is unavailable, image setup is missing, or the candidate errors/times out, the attempt records **Verification unavailable**; it never falls back to running generated code on the host. The baseline model prompt is intentionally underspecified about discount ordering; the acceptance contract and correction are visible in the evidence screen. This is a debugging exercise, not a model benchmark.

## Verify the project

```bash
pnpm check
```

This runs lint, TypeScript checks, the backend test suite, and both production builds. Tests cover real fixture execution, API behavior, durable demo evidence, lineage, restart detection, concurrency rejection, malformed output, provider failures, and workspace containment.

Three additional integration tests require Docker/PostgreSQL and are explicitly skipped unless enabled:

```bash
RUN_DATABASE_TESTS=true RUN_DOCKER_TESTS=true pnpm -C backend test
```

GitHub Actions provisions PostgreSQL, deploys migrations, pulls the verifier image, and enables those integration tests. The Docker test also checks timeout behavior. Environment setup is the same as the full application above.

Browser tests cover the baseline/correction story, exact inputs, keyboard tabs, JSON export, reload persistence, mobile overflow, console errors, and API-error recovery at desktop and phone viewport sizes:

```bash
pnpm exec playwright install chromium
pnpm test:e2e
```

Stop any existing demo server first. The tests start their own isolated demo. CI also runs these tests and uploads screenshots/traces as the `browser-evidence` artifact.

## Scope and honest limitations

- This release implements **one complete investigation**, not a general autonomous coding platform.
- Corrected attempts make a new generation request (or load a clearly labeled fixture). They are not deterministic model replay or checkpoint resume.
- The suite covers seven known cases. Passing it is not proof of general correctness, security, or production readiness.
- Content hashes identify evidence; they are not signed attestations or tamper-proof storage.
- The process-local execution lock and restart recovery assume one API process. Durable queues, leases, cancellation, and multi-instance recovery are future work.
- Container isolation is defense in depth, not a hostile-code hosting service. Docker and the verifier image must be trusted and maintained.
- The existing GitHub PR workflow has **not** been connected to investigation verification gates. This release does not publish investigation candidates.
- Legacy run metrics describe completion of model calls, not verified task success.

## Architecture and demo

- [Architecture](docs/architecture.md)
- [Design decisions](docs/decisions.md)
- [Three-minute walkthrough](docs/demo.md)

MIT licensed. This portfolio project is independent of the existing AgentOps observability product; a distinct product name is still to be chosen.
