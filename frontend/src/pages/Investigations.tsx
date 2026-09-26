import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Button from "../components/Button";
import { getInvestigation, getScenario, listInvestigations, startInvestigation } from "../lib/api/investigations";
import type { Investigation, Scenario } from "../lib/api/investigations";

const money = (cents: number | null) => cents === null ? "—" : `$${(cents / 100).toFixed(2)}`;
const verdict = { not_run: "Not verified", passed: "Checks passed", failed: "Regression detected", error: "Verification unavailable" };
const countPassed = (run: Investigation) => run.checks.filter(check => check.passed).length;

function Evidence({ run, parent }: { run: Investigation; parent: Investigation | null }) {
  const [tab, setTab] = useState<"checks" | "code" | "context">("checks");
  const [downloadError, setDownloadError] = useState<string | null>(null);
  function download() {
    try {
      const url = URL.createObjectURL(new Blob([JSON.stringify(run, null, 2)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url; link.download = `investigation-${run.id}.json`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setDownloadError("Your browser could not download the evidence. Try a desktop browser."); }
  }
  return <>
    <div className="lab-outcomes" aria-label="Attempt outcomes">
      <div><span className="lab-kicker">Execution</span><strong>{run.execution === "completed" ? "Completed" : run.execution}</strong><small>A response is not a correctness verdict.</small></div>
      <div><span className="lab-kicker">Verification</span><strong className={`lab-text-${run.verification}`}>{verdict[run.verification]}</strong><small>{run.checks.length ? `${countPassed(run)} of ${run.checks.length} independent checks passed` : "No valid regression results available"}</small></div>
      <div><span className="lab-kicker">Provenance</span><strong>{run.source === "fixture" ? "Authored fixture" : run.model || "Live model"}</strong><small>{run.source === "fixture" ? "No model call · no token charges" : `${run.usage?.totalTokens ?? "Unknown"} tokens · fresh model response`}</small></div>
    </div>
    {run.error ? <div className="lab-alert" role="alert">{run.error}</div> : null}
    {parent ? <div className="lab-comparison">
      <span className="lab-kicker">Compared with original</span>
      <strong>{parent.checks.length ? `${countPassed(parent)}/${parent.checks.length}` : "Not verified"} → {run.checks.length ? `${countPassed(run)}/${run.checks.length} checks passed` : "Not verified"}</strong>
      <span>{run.suiteHash === parent.suiteHash ? "Same regression suite. Original evidence preserved." : "Different suites: results are not directly comparable."}</span>
    </div> : null}
    <div className="lab-evidence-grid">
      <section className="lab-panel">
        <div className="lab-panel-heading"><h2>Evidence explorer</h2><Button variant="ghost" onClick={download}>Export JSON ↓</Button></div>
        {downloadError ? <p role="alert">{downloadError}</p> : null}
        <div className="lab-tabs" role="tablist" aria-label="Evidence type">
          {(["checks", "code", "context"] as const).map(value => <button key={value} role="tab" id={`tab-${value}`} aria-selected={tab === value} tabIndex={tab === value ? 0 : -1} onKeyDown={event => {
            const tabs = ["checks", "code", "context"] as const;
            const index = tabs.indexOf(value);
            const next = event.key === "ArrowRight" ? tabs[(index + 1) % 3] : event.key === "ArrowLeft" ? tabs[(index + 2) % 3] : event.key === "Home" ? tabs[0] : event.key === "End" ? tabs[2] : null;
            if (next) { event.preventDefault(); setTab(next); document.getElementById(`tab-${next}`)?.focus(); }
          }} aria-controls={`panel-${value}`} onClick={() => setTab(value)}>{value === "checks" ? "Regression checks" : value === "code" ? "Candidate code" : "Exact inputs"}</button>)}
        </div>
        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
          {tab === "checks" ? <>
            {run.checks.length ? <div className="lab-checks">{run.checks.map(check => <div key={check.name} className={`lab-check ${check.passed ? "" : "lab-check-failed"}`}>
              <span className={`lab-check-icon ${check.passed ? "is-pass" : "is-fail"}`} aria-label={check.passed ? "Passed" : "Failed"}>{check.passed ? "✓" : "×"}</span>
              <div><strong>{check.name}</strong><small>Subtotal {money(check.args[0])} · discount {money(check.args[1])}</small></div>
              <div className="lab-check-values"><span>Expected <b>{money(check.expected)}</b></span><span>Received <b>{money(check.actual)}</b></span></div>
            </div>)}</div> : <p className="lab-note">No checks have completed. A missing result never counts as a pass.</p>}
            <p className="lab-note">Expected values are evaluated outside the candidate process. Passing this fixed suite does not prove correctness for every input.</p>
          </> : tab === "code" ? <div className="lab-code-pair">
            {parent?.code ? <div><p className="lab-kicker">Original candidate</p><pre className="lab-code"><code>{parent.code}</code></pre></div> : null}
            <div><p className="lab-kicker">{parent ? "New candidate" : "Candidate under test"}</p><pre className="lab-code"><code>{run.code || "No candidate was generated."}</code></pre></div>
          </div> : <div className="lab-context">
            <h3>Acceptance contract</h3><p>{run.requirement}</p>
            <h3>System prompt</h3><pre>{run.systemPrompt}</pre>
            <h3>Attempt instructions</h3><pre>{run.instruction}</pre>
            <h3>Evidence fingerprints</h3><p>Candidate SHA-256</p><code>{run.codeHash || "Unavailable"}</code><p>Suite SHA-256</p><code>{run.suiteHash}</code>
            <p className="lab-note">Hashes identify content; they are not signatures or tamper-proof attestations.</p>
          </div>}
        </div>
      </section>
      <aside className="lab-panel lab-timeline"><span className="lab-kicker">Execution trail</span><h2>What happened</h2>
        <ol>{run.events.map((event, index) => <li key={`${index}-${event.at}`}><span className="lab-event-number">{String(index + 1).padStart(2, "0")}</span><div><strong>{event.title}</strong><p>{event.detail}</p><time dateTime={event.at}>{new Date(event.at).toLocaleTimeString()}</time></div></li>)}</ol>
        <p className="lab-note">Attempt {run.id.slice(0, 8)}<br />Verifier: {run.verifier}</p>
      </aside>
    </div>
  </>;
}

export default function Investigations() {
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("attempt");
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [runs, setRuns] = useState<Investigation[]>([]);
  const [selected, setSelected] = useState<Investigation | null>(null);
  const [parent, setParent] = useState<Investigation | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<Investigation["source"]>("fixture");
  const [revision, setRevision] = useState(0);
  const submitting = useRef(false);

  useEffect(() => {
    let ignore = false;
    setLoading(true); setError(null); setSelected(null); setParent(null);
    async function load() {
      try {
        const [nextScenario, nextRuns, requested] = await Promise.all([getScenario(), listInvestigations(), selectedId ? getInvestigation(selectedId) : Promise.resolve(null)]);
        const nextSelected = requested || nextRuns[0] || null;
        const nextParent = nextSelected?.parentId ? nextRuns.find(r => r.id === nextSelected.parentId) || await getInvestigation(nextSelected.parentId) : null;
        if (!ignore) { setScenario(nextScenario); setRuns(nextRuns); setSelected(nextSelected); setParent(nextParent); }
      } catch (err) { if (!ignore) setError(err instanceof Error ? err.message : "Could not load investigations"); }
      finally { if (!ignore) setLoading(false); }
    }
    void load();
    return () => { ignore = true; };
  }, [selectedId, revision]);

  async function start(corrected: boolean) {
    if (submitting.current) return;
    submitting.current = true; setBusy(true); setError(null);
    try {
      const run = await startInvestigation(corrected && selected ? selected.source : source, corrected ? selected?.id : undefined);
      setParams({ attempt: run.id });
    } catch (err) { setError(err instanceof Error ? err.message : "Could not start investigation"); }
    finally { submitting.current = false; setBusy(false); }
  }

  return <div className="lab">
    <header className="lab-header"><div><p className="eyebrow">Reliability lab / Experiment 01</p><h1>Trust the evidence.</h1><p>Inspect the failure. Test the correction. Keep the proof.</p></div><span className="lab-local"><span /> {import.meta.env.VITE_DEMO_MODE === "true" ? "Local fixture demo" : "Local development"}</span></header>
    <section className="lab-scenario">
      <div className="lab-scenario-copy"><span className="lab-kicker">The investigation</span><h2>{scenario?.title || "The free-shipping regression"}</h2><p>{scenario?.description || "Test whether a coding attempt meets its acceptance criteria."}</p><div className="lab-contract">Rule: free shipping at $50 <strong>after discounts.</strong> Otherwise, $5.99.</div></div>
      <div className="lab-controls">
        <label htmlFor="attempt-source">Response source</label>
        <select id="attempt-source" value={source} onChange={e => setSource(e.target.value as Investigation["source"])} disabled={busy}>
          <option value="fixture">Authored fixture · no API key</option>{scenario?.liveEnabled ? <option value="live">Live model · uses API credits</option> : null}
        </select>
        <Button disabled={busy || loading || !scenario} onClick={() => void start(false)}>{busy ? "Running and verifying…" : "Run baseline investigation ↗"}</Button>
        <small>{source === "fixture" ? "Illustrative responses. Real regression checks. Saved evidence." : "Fresh generated code runs only in a restricted Docker container."}</small>
      </div>
    </section>
    {error ? <div className="lab-alert" role="alert"><strong>Investigation could not complete.</strong> {error} <Button variant="ghost" onClick={() => setRevision(r => r + 1)}>Retry loading</Button></div> : null}
    <div role="status" aria-live="polite">{busy ? <div className="lab-progress">Running the candidate and collecting evidence. This may take up to a minute for a live model.</div> : loading ? <p className="muted">Loading saved evidence…</p> : null}</div>
    {selected && !loading ? <>
      <div className="lab-attempt-heading"><div><span className="lab-kicker">Saved attempt / {selected.id.slice(0, 8)}</span><h2>{selected.parentId ? "The correction, under test." : "A response is only the beginning."}</h2></div>
        <div className="lab-attempt-actions"><label className="lab-sr-only" htmlFor="saved-attempt">Saved attempt</label><select id="saved-attempt" value={selected.id} disabled={busy} onChange={e => setParams({ attempt: e.target.value })}>
          {!runs.some(run => run.id === selected.id) ? <option value={selected.id}>{selected.id.slice(0, 8)}</option> : null}
          {runs.map(run => <option key={run.id} value={run.id}>{run.parentId ? "Correction" : "Baseline"} · {run.source} · {run.id.slice(0, 8)} · {verdict[run.verification]}</option>)}
        </select><Button variant="secondary" disabled={busy || !selected.code || !selected.endedAt} onClick={() => void start(true)}>Try corrected instructions →</Button></div>
      </div>
      {selected.code && selected.endedAt ? <p className="lab-guidance">Next attempt adds: “{scenario?.correction}” {selected.source === "fixture" ? "Fixture mode loads the bundled corrected example." : "Live mode makes a new model call."}</p> : null}
      <Evidence key={selected.id} run={selected} parent={parent} />
    </> : !loading && !error ? <section className="lab-empty"><span className="lab-empty-symbol">↳</span><h2>Start with a failure you can explain.</h2><p>Run the baseline to uncover the discount edge case. Then test corrected instructions and compare the evidence.</p><div><span>01 / Run</span><span>02 / Inspect</span><span>03 / Correct</span></div></section> : null}
    <footer className="lab-footer"><span>AgentOps / Reliability lab</span><span>Execution ≠ correctness</span></footer>
  </div>;
}
