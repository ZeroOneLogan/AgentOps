import app, { investigations } from "./app.js";
import { env } from "./lib/env.js";
import { prisma } from "./lib/db.js";

await investigations.recoverInterrupted();
const server = app.listen(env.PORT, env.HOST, () => {
  console.log(`[backend] listening on http://localhost:${env.PORT}`);
});

const shutdown = async (signal: string) => {
  console.log(`[backend] received ${signal}, shutting down`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};

["SIGINT", "SIGTERM"].forEach((signal) => {
  process.on(signal, () => {
    shutdown(signal).catch((err) => {
      console.error("[backend] shutdown error", err);
      process.exit(1);
    });
  });
});
