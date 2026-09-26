import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { BASELINE_CODE, CORRECTED_CODE, CASES } from "./scenario.js";
import type { CheckResult } from "./types.js";

// Expected values remain in the host evaluator, outside the candidate process.
const HARNESS = `import { quoteShipping } from './candidate.mjs';
const inputs = ${JSON.stringify(CASES.map(c => c.args))};
const results = inputs.map(args => quoteShipping(...args));
process.stdout.write(JSON.stringify(results));\n`;

function run(file: string, args: string[], timeout: number) {
  return new Promise<string>((resolve, reject) => {
    execFile(file, args, { timeout, maxBuffer: 32 * 1024, killSignal: "SIGKILL", env: { PATH: process.env.PATH, HOME: process.env.HOME, DOCKER_HOST: process.env.DOCKER_HOST } }, (error, stdout) => {
      if (error) reject(new Error(error.killed ? "Verification exceeded its time or output limit" : `Verifier process failed: ${error.message.slice(0, 1200)}`));
      else resolve(stdout);
    });
  });
}

export function evaluateResults(stdout: string): CheckResult[] {
  const actual: unknown = JSON.parse(stdout);
  if (!Array.isArray(actual) || actual.length !== CASES.length || actual.some(v => !Number.isSafeInteger(v))) {
    throw new Error("Candidate did not return one integer shipping fee per test case");
  }
  return CASES.map((test, index) => ({ ...test, actual: actual[index] as number, passed: actual[index] === test.expected }));
}

export function dockerArgs(directory: string, name: string, image: string) {
  return ["run", "--rm", "--pull=never", "--name", name, "--network=none", "--read-only", "--cap-drop=ALL",
    "--security-opt=no-new-privileges", "--pids-limit=32", "--memory=128m", "--cpus=0.5", "--user=65534:65534",
    "--mount", `type=bind,src=${directory},dst=/work,readonly`, "--workdir=/work", image, "node", "harness.mjs"];
}

export async function verifyCandidate(code: string, source: "fixture" | "live") {
  // Never let a request label arbitrary code as a trusted fixture.
  if (source === "fixture" && code !== BASELINE_CODE && code !== CORRECTED_CODE) {
    throw new Error("Only bundled demonstration fixtures may run outside Docker");
  }
  const directory = await fs.mkdtemp(path.join(tmpdir(), "agentops-verify-"));
  const name = `agentops-${randomUUID()}`;
  try {
    await fs.chmod(directory, 0o755);
    await fs.writeFile(path.join(directory, "candidate.mjs"), code, { mode: 0o444 });
    await fs.writeFile(path.join(directory, "harness.mjs"), HARNESS, { mode: 0o444 });
    const stdout = source === "fixture"
      ? await run(process.execPath, [path.join(directory, "harness.mjs")], 3000)
      : await run("docker", dockerArgs(directory, name, process.env.VERIFIER_IMAGE || "node:22-alpine"), 10000);
    return evaluateResults(stdout);
  } finally {
    // Killing the Docker CLI does not necessarily stop the container.
    if (source === "live") await run("docker", ["rm", "-f", name], 3000).catch(() => undefined);
    await fs.rm(directory, { recursive: true, force: true });
  }
}
