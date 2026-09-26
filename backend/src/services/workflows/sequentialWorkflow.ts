import type { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { prisma } from "../../lib/db.js";
import { executeSingleAgent, logEvent } from "../runner.js";
import { buildContextPrompt } from "../contextBuilder.js";

const STEPS = ["Planner", "Coder", "Reviewer"] as const;

type StepName = (typeof STEPS)[number];

type WorkflowContext = {
  workflowId: string;
  taskId: string;
  runIds: string[];
  agents: Record<string, { id: string; systemPrompt: string; modelName?: string | null }>;
  task: { title: string; description?: string | null };
  context: {
    prompt: string;
    total_bytes: number;
    files: Array<{ path: string; size_bytes: number; language: string }>;
    workspace_name?: string;
  };
};

function buildPlannerPrompt(baseContext: string) {
  return [baseContext, "", "Instruction: Create a clear step-by-step plan."].join("\n");
}

function buildCoderPrompt(baseContext: string, plannerOutput: string) {
  return [baseContext, "", "Planner Output:", plannerOutput, "", "Instruction: Implement or solve the task following the plan."].join("\n");
}

function buildReviewerPrompt(baseContext: string, coderOutput: string) {
  return [baseContext, "", "Coder Output:", coderOutput, "", "Instruction: Review the solution critically and suggest improvements."].join("\n");
}

async function createWorkflowRuns(
  taskId: string,
  agentIds: string[],
  workspaceName?: string,
  contextFiles?: string[]
) {
  const workflowId = randomUUID();

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) {
    throw new Error("Task not found");
  }

  const agents = await prisma.agent.findMany({ where: { id: { in: agentIds } } });
  const agentById = new Map(agents.map((agent) => [agent.id, agent]));

  const orderedAgents = agentIds.map((id) => agentById.get(id));
  if (orderedAgents.some((agent) => !agent)) {
    throw new Error("One or more agents not found");
  }

  const runIds: string[] = [];
  const context = await buildContextPrompt(task.title, task.description, workspaceName, contextFiles);

  for (let stepIndex = 0; stepIndex < STEPS.length; stepIndex += 1) {
    const agent = orderedAgents[stepIndex]!;
    const run = await prisma.run.create({
      data: {
        taskId,
        agentId: agent.id,
        status: "queued",
        input: {
          workflow_id: workflowId,
          workflow_step_index: stepIndex,
          workflow_step_name: STEPS[stepIndex],
          input: {
            task_title: task.title,
            task_description: task.description
          },
          workspace_name: workspaceName,
          context_files: context.files,
          total_context_bytes: context.total_bytes
        }
      }
    });
    runIds.push(run.id);

    await logEvent(run.id, "run_created", "Run created", {
      workflow_id: workflowId,
      step: STEPS[stepIndex]
    });

    if (context.files.length > 0) {
      await logEvent(run.id, "context_attached", "Context attached", {
        workflow_id: workflowId,
        step: STEPS[stepIndex],
        total_context_bytes: context.total_bytes,
        context_files: context.files.map((file) => file.path)
      });
    }
  }

  return {
    workflowId,
    taskId,
    runIds,
    task: { title: task.title, description: task.description },
    agents: Object.fromEntries(orderedAgents.map((agent) => [agent!.id, agent!])),
    context: {
      ...context,
      workspace_name: workspaceName
    }
  } satisfies WorkflowContext;
}

async function updateRunInput(runId: string, input: Record<string, unknown>) {
  await prisma.run.update({
    where: { id: runId },
    data: {
      input: JSON.parse(JSON.stringify(input)) as Prisma.InputJsonValue
    }
  });
}

async function executeWorkflowSteps(context: WorkflowContext, agentIds: string[]) {
  const { workflowId, runIds, task } = context;

  let plannerOutput = "";
  let coderOutput = "";

  for (let stepIndex = 0; stepIndex < STEPS.length; stepIndex += 1) {
    const stepName = STEPS[stepIndex];
    const agentId = agentIds[stepIndex];
    const agent = context.agents[agentId];
    const runId = runIds[stepIndex];

    const baseContext = context.context.prompt;
    const userPrompt =
      stepName === "Planner"
        ? buildPlannerPrompt(baseContext)
        : stepName === "Coder"
        ? buildCoderPrompt(baseContext, plannerOutput)
        : buildReviewerPrompt(baseContext, coderOutput);

    await updateRunInput(runId, {
      workflow_id: workflowId,
      workflow_step_index: stepIndex,
      workflow_step_name: stepName,
      input: {
        task_title: task.title,
        task_description: task.description,
        planner_output: plannerOutput || undefined,
        coder_output: coderOutput || undefined,
        user_prompt: userPrompt
      },
      workspace_name: context.context.workspace_name,
      context_files: context.context.files,
      total_context_bytes: context.context.total_bytes
    });

    if (stepIndex === 0) {
      await logEvent(runId, "workflow_started", "Workflow started", {
        workflow_id: workflowId
      });
    }

    await logEvent(runId, "step_started", `${stepName} started`, {
      workflow_id: workflowId,
      step: stepName,
      step_index: stepIndex
    });

    try {
      const result = await executeSingleAgent({
        runId,
        systemPrompt: agent.systemPrompt,
        userPrompt,
        modelName: agent.modelName
      });

      if (stepName === "Planner") plannerOutput = result.text;
      if (stepName === "Coder") coderOutput = result.text;

      await logEvent(runId, "step_completed", `${stepName} completed`, {
        workflow_id: workflowId,
        step: stepName,
        step_index: stepIndex,
        model: result.model
      });
    } catch (_error) {
      await logEvent(runId, "step_failed", `${stepName} failed`, {
        workflow_id: workflowId,
        step: stepName,
        step_index: stepIndex
      });

      await logEvent(runId, "workflow_failed", "Workflow failed", {
        workflow_id: workflowId,
        failed_step: stepName
      });

      await prisma.run.updateMany({
        where: { id: { in: runIds.slice(stepIndex + 1) }, status: "queued" },
        data: { status: "skipped", endedAt: new Date(), error: `Not executed: ${stepName} failed` }
      });
      break;
    }

    if (stepIndex === STEPS.length - 1) {
      await logEvent(runId, "workflow_completed", "Workflow completed", {
        workflow_id: workflowId
      });
    }
  }
}

export async function startSequentialWorkflow(
  taskId: string,
  agentIds: string[],
  workspaceName?: string,
  contextFiles?: string[]
) {
  const context = await createWorkflowRuns(taskId, agentIds, workspaceName, contextFiles);

  void executeWorkflowSteps(context, agentIds).catch((error) => {
    console.error("[workflow] execution failed", error);
  });

  return { workflowId: context.workflowId, runIds: context.runIds };
}

export type { StepName };
