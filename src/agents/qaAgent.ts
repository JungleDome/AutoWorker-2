import { Codex, type ApprovalMode, type SandboxMode } from "@openai/codex-sdk";
import { config } from "../config.js";
import {
  AgentOutputEnvelopeQaReportSchema,
} from "../models/domainSchemas.js";
import type {
  AgentOutputEnvelopeExecutionResult,
  AgentOutputEnvelopeQaReport,
  AgentRole,
  PlanPayload,
} from "../models/domainTypes.js";
import { QaReportOutputSchemaStrict } from "../models/outputSchemas.js";
import { recordQaReport } from "../storage.js";

const QA_ROLE: AgentRole = "QA Specialist (QA Engineer)";

const codex = new Codex();

export interface QaRunOptions {
  ticketId: string;
  plan: PlanPayload;
  executionResults: AgentOutputEnvelopeExecutionResult[];
  notesForAgent?: string;
  workingDirectory?: string;
}

export async function runQaForTicket(
  options: QaRunOptions,
): Promise<AgentOutputEnvelopeQaReport> {
  const thread = codex.startThread({
    model: config.codex.model,
    sandboxMode: "read-only",
    approvalPolicy: config.codex.approvalPolicy as ApprovalMode | undefined,
    workingDirectory:
      options.workingDirectory ?? config.codex.workingDirectory ?? process.cwd(),
    skipGitRepoCheck: true,
    networkAccessEnabled: config.codex.networkAccessEnabled,
    webSearchEnabled: config.codex.webSearchEnabled,
  });

  const instructions = buildQaPrompt(options);

  const turn = await thread.run(instructions, {
    outputSchema: QaReportOutputSchemaStrict,
  });

  const raw = turn.finalResponse;
  let parsed: unknown = raw;

  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown parse error";
      throw new Error(`Failed to parse QA output as JSON: ${message}`);
    }
  }

  let envelope: AgentOutputEnvelopeQaReport;
  try {
    envelope = AgentOutputEnvelopeQaReportSchema.parse(parsed);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown validation error";
    throw new Error(
      `QA agent output failed schema validation: ${message}`,
    );
  }

  if (envelope.payload_type !== "qa_report") {
    throw new Error(
      `QA agent must return payload_type="qa_report", got "${envelope.payload_type}"`,
    );
  }
  if (envelope.agent_role !== QA_ROLE) {
    throw new Error(
      `QA agent must return agent_role="${QA_ROLE}", got "${envelope.agent_role}"`,
    );
  }
  if (envelope.ticket_id !== options.ticketId) {
    throw new Error(
      `QA agent returned ticket_id="${envelope.ticket_id}" but expected "${options.ticketId}"`,
    );
  }

  const payloadPlanId = (envelope.payload as { plan_id?: string }).plan_id;
  if (payloadPlanId && payloadPlanId !== options.plan.plan_id) {
    throw new Error(
      `QA agent returned plan_id="${payloadPlanId}" but expected "${options.plan.plan_id}"`,
    );
  }

  recordQaReport(envelope);

  return envelope;
}

function buildQaPrompt(options: QaRunOptions): string {
  const header = [
    "You are the QA Specialist (QA Engineer) agent in a multi-stage delivery pipeline.",
    "You receive the approved PlanPayload and one or more ExecutionResultPayloads and must respond with a JSON object that matches the AgentOutputEnvelope and QaReportPayload specification.",
    "Project context lives in the working directory under ./.autoworker/; you may search/read it as needed.",
    "",
    "CRITICAL:",
    "- Respond with JSON only, no surrounding text.",
    "- agent_role MUST be exactly \"QA Specialist (QA Engineer)\".",
    "- payload_type MUST be \"qa_report\".",
    "- ticket_id MUST match the provided ticket id.",
    "- payload.plan_id MUST match the provided plan_id.",
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

  const executionSummaryLines: string[] = [];

  for (const exec of options.executionResults) {
    const runId = exec.run_id;
    const partial = exec.payload as { summary?: string };
    executionSummaryLines.push(
      `- Execution run ${runId}: ${partial.summary ?? "(no summary field provided)"}`,
    );
  }

  const executionSection = [
    "Recent execution runs (from Implementer):",
    ...(executionSummaryLines.length > 0
      ? executionSummaryLines
      : ["(No execution results provided; base your QA mainly on the plan.)"]),
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
    "- Set overall_status to pass, fail, partial, or blocked based on acceptance criteria and observed behaviour.",
    "- Use tested_acceptance_criteria to link QA checks back to requirement ids like AC1, AC2.",
    "- Use issues_found to record concrete problems with severity and related_steps.",
    "- Use recommendation to clearly state whether the ticket can be considered done or needs fixes before release.",
    "- Use questions_for_human when policy or risk tolerance decisions are needed.",
  ];

  return [
    ...header,
    ...planSummary,
    ...executionSection,
    ...notesSection,
    ...guidance,
  ].join("\n");
}
