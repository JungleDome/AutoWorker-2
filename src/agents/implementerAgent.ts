import { Codex, type ApprovalMode, type SandboxMode } from "@openai/codex-sdk";
import { config } from "../config.js";
import {
  AgentOutputEnvelopeExecutionResultSchema,
} from "../models/domainSchemas.js";
import type {
  AgentOutputEnvelopeExecutionResult,
  AgentRole,
  PlanPayload,
  PlanStep,
} from "../models/domainTypes.js";
import {
  ExecutionResultOutputSchemaStrict,
} from "../models/outputSchemas.js";
import { recordExecutionResult } from "../storage.js";

const IMPLEMENTER_ROLE: AgentRole = "Implementer (Software Engineer)";

const codex = new Codex();

export interface ImplementerRunOptions {
  ticketId: string;
  plan: PlanPayload;
  stepIds?: string[];
  notesForAgent?: string;
  workingDirectory?: string;
}

export async function runImplementerForTicket(
  options: ImplementerRunOptions,
): Promise<AgentOutputEnvelopeExecutionResult> {
  const thread = codex.startThread({
    model: config.codex.model,
    sandboxMode: config.codex.sandboxMode as SandboxMode | undefined,
    approvalPolicy: config.codex.approvalPolicy as ApprovalMode | undefined,
    workingDirectory:
      options.workingDirectory ?? config.codex.workingDirectory ?? process.cwd(),
    skipGitRepoCheck: true,
    networkAccessEnabled: config.codex.networkAccessEnabled,
    webSearchEnabled: config.codex.webSearchEnabled,
    modelReasoningEffort: "high"
  });

  const instructions = buildImplementerPrompt(options);

  const turn = await thread.run(instructions, {
    outputSchema: ExecutionResultOutputSchemaStrict,
  });

  const raw = turn.finalResponse;
  let parsed: unknown = raw;

  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown parse error";
      throw new Error(`Failed to parse execution output as JSON: ${message}`);
    }
  }

  let envelope: AgentOutputEnvelopeExecutionResult;
  try {
    envelope = AgentOutputEnvelopeExecutionResultSchema.parse(parsed);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown validation error";
    throw new Error(
      `Implementer agent output failed schema validation: ${message}`,
    );
  }

  if (envelope.payload_type !== "execution_result") {
    throw new Error(
      `Implementer must return payload_type="execution_result", got "${envelope.payload_type}"`,
    );
  }
  if (envelope.agent_role !== IMPLEMENTER_ROLE) {
    throw new Error(
      `Implementer must return agent_role="${IMPLEMENTER_ROLE}", got "${envelope.agent_role}"`,
    );
  }
  if (envelope.ticket_id !== options.ticketId) {
    throw new Error(
      `Implementer returned ticket_id="${envelope.ticket_id}" but expected "${options.ticketId}"`,
    );
  }

  const payloadPlanId = (envelope.payload as { plan_id?: string }).plan_id;
  if (payloadPlanId && payloadPlanId !== options.plan.plan_id) {
    throw new Error(
      `Implementer returned plan_id="${payloadPlanId}" but expected "${options.plan.plan_id}"`,
    );
  }

  recordExecutionResult(envelope);

  return envelope;
}

function buildImplementerPrompt(options: ImplementerRunOptions): string {
  const header = [
    "You are the Implementer (Software Engineer) agent in a multi-stage delivery pipeline.",
    "You receive the approved PlanPayload for a ticket and must respond with a JSON object that matches the AgentOutputEnvelope and ExecutionResultPayload specification.",
    "",
    "CRITICAL:",
    "- Respond with JSON only, no surrounding text.",
    "- agent_role MUST be exactly \"Implementer (Software Engineer)\".",
    "- payload_type MUST be \"execution_result\".",
    "- ticket_id MUST match the provided ticket id.",
    "- payload.plan_id MUST match the provided plan_id.",
    "- payload.handled_steps MUST list each plan step you attempted to work on and how its status changed.",
    "",
  ];

  const planSummary = [
    `Ticket id: ${options.ticketId}`,
    `Plan id: ${options.plan.plan_id}`,
    `Plan version: ${options.plan.plan_version}`,
    "",
    "Plan summary:",
    options.plan.summary,
    "",
  ];

  const stepSummaries: string[] = [];

  function flattenSteps(steps: PlanStep[]): PlanStep[] {
    const all: PlanStep[] = [];
    for (const step of steps) {
      all.push(step);
      if (step.children.length > 0) {
        all.push(...flattenSteps(step.children));
      }
    }
    return all;
  }

  const allSteps = flattenSteps(options.plan.steps);
  const targetIds = options.stepIds && options.stepIds.length > 0
    ? new Set(options.stepIds)
    : undefined;

  for (const step of allSteps) {
    if (targetIds && !targetIds.has(step.id)) {
      continue;
    }
    stepSummaries.push(
      `- [${step.id}] (${step.kind}, owner=${step.owner_role}, risk=${step.risk_level}) ${step.title}`,
    );
  }

  const stepsSection = [
    "Relevant plan steps:",
    ...(stepSummaries.length > 0
      ? stepSummaries
      : ["(No specific steps requested; you may pick appropriate pending steps.)"]),
    "",
  ];

  const notesSection =
    options.notesForAgent && options.notesForAgent.trim().length > 0
      ? [
          "Additional notes from controller/human:",
          options.notesForAgent,
          "",
        ]
      : [];

  const guidance = [
    "Guidance:",
    "- Only update statuses for steps you actually attempted to work on.",
    "- Use new_status of done, in_progress, blocked, or skipped as appropriate.",
    "- Provide clear, concise summaries of what you implemented and how to verify it.",
    "- Use plan_feedback to report whether the plan was sufficient and if replanning is recommended.",
    "- Use human_review.suggested and human_review.focus_areas to indicate if manual review is needed before merging or deploying.",
  ];

  return [
    ...header,
    ...planSummary,
    ...stepsSection,
    ...notesSection,
    ...guidance,
  ].join("\n");
}
