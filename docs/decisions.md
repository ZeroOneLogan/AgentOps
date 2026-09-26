# Design decisions

## A focused regression story

One understandable bug supports an end-to-end demonstration of inputs, failure, correction, and evidence. The initial prompt omits discount ordering; the acceptance contract makes the intended behavior explicit. This is intentionally a controlled debugging exercise, not evidence that a particular model is weak.

## Execution is separate from verification

A completed response may fail regression checks. Infrastructure failure leaves verification unavailable. This distinction prevents misleading success rates and is the core product behavior.

## Independent, deterministic checks

The model does not grade itself. A process returns values; the host evaluates those values against the acceptance suite. Fixed cases provide reproducible evidence for their inputs, but cannot establish correctness for all inputs.

## Authored fixtures and optional live generation

An employer can explore the application without creating accounts or paying API costs. Fixture provenance is visible throughout the UI. The same service/verifier flow supports live responses, whose outcomes may vary. Fixtures have no fabricated model names, token counts, or measured API costs.

## File store for a zero-setup demo, PostgreSQL for full mode

The store interface keeps the investigation logic shared. Atomic file replacement is sufficient for a small local demo and makes it easy to test restart behavior. PostgreSQL remains the full application's persistence layer. Neither mode currently supports coordinated execution across multiple API instances.

## Refuse unsafe verification fallbacks

Only exact bundled fixtures may execute in a host subprocess. Generated code always uses Docker. A missing daemon or image yields an explicit unavailable result. Docker restrictions reduce risk but do not make this suitable for accepting public untrusted submissions.

## New attempts preserve old evidence

A correction creates a new record referencing the original and shows both candidates and outcomes. We do not claim deterministic LLM replay, full checkpoint resumption, cryptographic attestation, or general code repair.

## Keep the current stack

React, Express, TypeScript, and PostgreSQL are sufficient for this milestone. The implementation adds no application runtime dependency. A lockfile and working ESM build improve reproducibility. Durable workers and verification-gated publication should follow only after this investigation flow is established.
