import { prisma } from "../lib/db";
import { runCompletion } from "./llmClient";
import { buildContextPrompt } from "./contextBuilder";

const DEFAULT_MODEL = "gpt-4.1-mini";

export function buildTaskPrompt(title: string, description?: string | null) {
  const lines = [
    "Task Title:",
    title.trim(),
    "",
    "Task Description:",
    description?.trim() || "(none)"
  ];
  return lines.join("\n");
}

type RunContextInput = {
  workspace_name?: string;
  context_files?: Array<{ path: string }>;
};

export async function logEvent(
  runId: string,
  event: string,
  message: string,
  meta?: Record<string, unknown>
) {
  await prisma.runLog.create({
    data: {
      runId,
      level: event.includes("failed") ? "error" : "info",
      message,
      meta: { event, ...meta }
    }
  });
}

type ExecuteParams = {
  runId: string;
  systemPrompt: string;
  userPrompt: string;
  modelName?: string | null;
};

export async function executeSingleAgent({
  runId,
  systemPrompt,
  userPrompt,
  modelName
}: ExecuteParams) {
  const resolvedModel = modelName || DEFAULT_MODEL;
  const start = Date.now();

  await prisma.run.update({
    where: { id: runId },
    data: {
      status: "running",
      startedAt: new Date()
    }
  });
  await logEvent(runId, "execution_started", "Execution started", { model: resolvedModel });

  try {
    await logEvent(runId, "llm_request_sent", "LLM request sent", { model: resolvedModel });

    const result = await runCompletion({
      systemPrompt,
      userPrompt,
      model: resolvedModel
    });

    await logEvent(runId, "llm_response_received", "LLM response received", {
      model: result.model,
      usage: result.usage
    });

    const durationMs = Date.now() - start;

    await prisma.run.update({
      where: { id: runId },
      data: {
        status: "succeeded",
        endedAt: new Date(),
        output: {
          text: result.text,
          model: result.model,
          usage: result.usage
        }
      }
    });

    await logEvent(runId, "execution_succeeded", "Execution succeeded", {
      duration_ms: durationMs,
      model: result.model,
      usage: result.usage
    });

    return { text: result.text, model: result.model, usage: result.usage };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown execution error";
    const durationMs = Date.now() - start;

    await prisma.run.update({
      where: { id: runId },
      data: {
        status: "failed",
        endedAt: new Date(),
        error: message
      }
    });

    await logEvent(runId, "execution_failed", "Execution failed", {
      duration_ms: durationMs,
      error: message
    });

    throw new Error(message);
  }
}

export async function executeRun(runId: string) {
  const run = await prisma.run.findUnique({
    where: { id: runId },
    include: { task: true, agent: true }
  });

  if (!run) {
    throw new Error("Run not found");
  }

  const input = run.input as RunContextInput | null;
  const contextFiles = input?.context_files?.map((file) => file.path) || [];

  const context = await buildContextPrompt(
    run.task.title,
    run.task.description,
    input?.workspace_name,
    contextFiles
  );

  const userPrompt = context.prompt;

  try {
    await executeSingleAgent({
      runId,
      systemPrompt: run.agent.systemPrompt,
      userPrompt,
      modelName: run.agent.modelName
    });
  } catch (error) {
    console.error("[runner] single execution failed", error);
  }
}
