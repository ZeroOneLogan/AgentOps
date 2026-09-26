import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  LLM_API_KEY: z.string().optional(),
  LLM_BASE_URL: z.string().optional(),
  WORKSPACE_ROOT: z.string().min(1, "WORKSPACE_ROOT is required"),
  GITHUB_TOKEN: z.string().optional(),
  PORT: z.coerce.number().int().positive().optional().default(4000),
  HOST: z.string().default("127.0.0.1"),
  NODE_ENV: z.string().optional()
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.flatten();
  throw new Error(`Invalid environment variables: ${JSON.stringify(details)}`);
}

export const env = parsed.data;
