ALTER TYPE "RunStatus" ADD VALUE 'skipped';
CREATE TABLE "investigations" (
  "id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "evidence" JSONB NOT NULL,
  CONSTRAINT "investigations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "investigations_created_at_idx" ON "investigations"("created_at");
