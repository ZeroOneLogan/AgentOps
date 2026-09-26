import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Investigation, InvestigationStore } from "./types.js";

// Local demo only. Atomic replacement prevents partially written evidence on restart.
export class FileInvestigationStore implements InvestigationStore {
  constructor(private readonly directory: string) {}
  private location(id: string) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Invalid investigation id");
    return path.join(this.directory, `${id}.json`);
  }
  async list() {
    await fs.mkdir(this.directory, { recursive: true, mode: 0o700 });
    const files = await fs.readdir(this.directory);
    const records = await Promise.all(files.filter(f => /^[0-9a-f-]{36}\.json$/i.test(f)).map(f => this.get(f.slice(0, -5))));
    return records.filter((r): r is Investigation => r !== null).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async get(id: string): Promise<Investigation | null> {
    try { return JSON.parse(await fs.readFile(this.location(id), "utf8")); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }
  async save(value: Investigation) {
    await fs.mkdir(this.directory, { recursive: true, mode: 0o700 });
    const target = this.location(value.id);
    const temporary = `${target}.${randomUUID()}.tmp`;
    try {
      await fs.writeFile(temporary, JSON.stringify(value, null, 2), { mode: 0o600 });
      await fs.rename(temporary, target);
    } finally { await fs.rm(temporary, { force: true }); }
  }
}
