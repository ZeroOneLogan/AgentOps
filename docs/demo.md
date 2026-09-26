# Three-minute walkthrough

Start with `pnpm install && pnpm demo`, then open http://localhost:5173.

1. **State the problem.** “An agent can finish its response and still produce incorrect code. This project separates execution from verification.”
2. **Run the baseline.** Select “Run baseline investigation.” Explain that fixture mode uses authored examples, while the tests really execute. Show “Completed” next to “Regression detected.”
3. **Inspect the failure.** Five checks pass. The discounted order and fully discounted order fail. Expected shipping is $5.99, but the function returns $0.
4. **Explain the source.** Open Candidate code. It checks `subtotalCents >= 5000` and ignores the discount argument. Open Exact inputs to show the intentionally underspecified prompt and explicit acceptance contract.
5. **Test the correction.** Select “Try corrected instructions.” In fixture mode this loads the authored corrected candidate and independently executes it. In live mode it makes a fresh model call and verifies in Docker.
6. **Compare evidence.** Show 5/7 → 7/7, both candidates, and the event trail. Select the original saved attempt to prove its outcome is unchanged. Refresh to demonstrate persistence.
7. **Export and discuss limits.** Export JSON. Explain that passing seven checks is evidence for those cases, not universal correctness. Hashes identify content but are not signatures.

Useful interview discussion: why not auto-retry an interrupted model call; why a provider response is not a quality metric; how to transition from a process lock to durable leases; how to bind a future PR approval to the exact code hash and repository commit that was verified.
