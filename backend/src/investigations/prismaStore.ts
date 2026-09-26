import { Prisma } from "@prisma/client";
import { prisma } from "../lib/db.js";
import type { Investigation, InvestigationStore } from "./types.js";

export class PrismaInvestigationStore implements InvestigationStore {
  async list() {
    const rows = await prisma.investigation.findMany({ orderBy: { createdAt: "desc" } });
    return rows.map(row => row.evidence as unknown as Investigation);
  }
  async get(id: string) {
    const row = await prisma.investigation.findUnique({ where: { id } });
    return row ? row.evidence as unknown as Investigation : null;
  }
  async save(value: Investigation) {
    const evidence = JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
    await prisma.investigation.upsert({
      where: { id: value.id },
      create: { id: value.id, createdAt: new Date(value.createdAt), evidence },
      update: { evidence }
    });
  }
}
