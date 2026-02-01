# decisions

## key tradeoffs
- sequential execution over queues: easier to understand and debug, slower at scale
- explicit file context over embeddings: predictable prompts and no hidden data flow
- no auth yet: keeps scope tight and the demo fast to run
- overwrite files for PRs: safe, explicit, and easy to audit

## what we did not build (yet)
- background workers and retries
- semantic search or vector databases
- streaming token output
- multi-tenant auth

## scaling considerations
- runs and logs can grow quickly; retention policies would be needed
- workflow execution should move to a queue for real production use
- metrics queries would need pre-aggregation at higher volumes

## why this is still useful
The code is small but shows end-to-end systems thinking: data modeling, execution flow, observability, and safe external integrations.
