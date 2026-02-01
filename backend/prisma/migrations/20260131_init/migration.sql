-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('queued', 'running', 'succeeded', 'failed');
CREATE TYPE "RunStatus" AS ENUM ('queued', 'running', 'succeeded', 'failed');
CREATE TYPE "RunLogLevel" AS ENUM ('debug', 'info', 'warn', 'error');

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateTable
CREATE TABLE "agents" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "system_prompt" TEXT NOT NULL,
  "model_provider" TEXT,
  "model_name" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tasks" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "TaskStatus" NOT NULL DEFAULT 'queued',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "runs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "task_id" UUID NOT NULL,
  "agent_id" UUID NOT NULL,
  "status" "RunStatus" NOT NULL DEFAULT 'queued',
  "started_at" TIMESTAMP(3),
  "ended_at" TIMESTAMP(3),
  "input" JSONB,
  "output" JSONB,
  "error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "run_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "run_id" UUID NOT NULL,
  "level" "RunLogLevel" NOT NULL DEFAULT 'info',
  "message" TEXT NOT NULL,
  "meta" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "run_logs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "runs" ADD CONSTRAINT "runs_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "run_logs" ADD CONSTRAINT "run_logs_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
