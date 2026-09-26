import { defineConfig } from "@playwright/test";
import { tmpdir } from "node:os";
import path from "node:path";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: { baseURL: "http://localhost:5173", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 1100 } } },
    { name: "phone", use: { viewport: { width: 390, height: 844 } } }
  ],
  webServer: {
    command: "pnpm demo",
    url: "http://localhost:5173",
    reuseExistingServer: false,
    timeout: 30_000,
    env: { DEMO_DATA_DIR: path.join(tmpdir(), `agentops-e2e-${process.pid}`) }
  }
});
