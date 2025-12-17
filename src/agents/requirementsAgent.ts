import { Codex, type ApprovalMode, type SandboxMode } from "@openai/codex-sdk";
import { config } from "../config.js";
import {
  AgentOutputEnvelopeRequirementsSchema,
} from "../models/domainSchemas.js";
import type {
  AgentOutputEnvelopeRequirements,
  AgentRole,
  RequirementsPayload,
} from "../models/domainTypes.js";
import {
  RequirementsOutputSchemaStrict,
} from "../models/outputSchemas.js";
import { recordRequirements } from "../storage.js";

const REQUIREMENTS_ROLE: AgentRole = "Request Owner (Product Manager)";

const codex = new Codex();

export interface RequirementsRunOptions {
  ticketId: string;
  rawTicketDescription: string;
  notesForAgent?: string;
  previousRequirements?: AgentOutputEnvelopeRequirements | null;
  requirementsFeedbackHistory?: string[];
  workingDirectory?: string;
}

export async function runRequirementsForTicket(
  options: RequirementsRunOptions,
): Promise<AgentOutputEnvelopeRequirements> {
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

  const instructions = buildRequirementsPrompt(options);

  const turn = await thread.run(instructions, {
    outputSchema: RequirementsOutputSchemaStrict,
  });

  const raw = turn.finalResponse;
  let parsed: unknown = raw;

  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown parse error";
      throw new Error(
        `Failed to parse requirements output as JSON: ${message}`,
      );
    }
  }

  let envelope: AgentOutputEnvelopeRequirements;
  try {
    envelope = AgentOutputEnvelopeRequirementsSchema.parse(parsed);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown validation error";
    throw new Error(
      `Requirements agent output failed schema validation: ${message}`,
    );
  }

  if (envelope.payload_type !== "requirements") {
    throw new Error(
      `Requirements agent must return payload_type="requirements", got "${envelope.payload_type}"`,
    );
  }
  if (envelope.agent_role !== REQUIREMENTS_ROLE) {
    throw new Error(
      `Requirements agent must return agent_role="${REQUIREMENTS_ROLE}", got "${envelope.agent_role}"`,
    );
  }
  if (envelope.ticket_id !== options.ticketId) {
    throw new Error(
      `Requirements agent returned ticket_id="${envelope.ticket_id}" but expected "${options.ticketId}"`,
    );
  }

  recordRequirements(envelope);

  return envelope;
}

function stringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function summarizePreviousRequirements(
  envelope: AgentOutputEnvelopeRequirements,
): string[] {
  const payload = envelope.payload as RequirementsPayload & {
    title?: string;
    problem_statement?: string;
    goal_statement?: string;
    non_goals?: unknown;
    context_summary?: string | null;
    constraints?: unknown;
    acceptance_criteria?: unknown;
    dependencies?: unknown;
    open_questions_for_stakeholders?: unknown;
    freeform_notes?: string | null;
    source?: { raw_description?: string };
  };

  const title = stringOrEmpty(payload.title);
  const problem = stringOrEmpty(payload.problem_statement);
  const goal = stringOrEmpty(payload.goal_statement);
  const context =
    payload.context_summary == null ? "" : stringOrEmpty(payload.context_summary);
  const freeformNotes =
    payload.freeform_notes == null ? "" : stringOrEmpty(payload.freeform_notes);
  const rawDescriptionFromPrev = payload.source
    ? stringOrEmpty(payload.source.raw_description)
    : "";

  const nonGoalsArray = Array.isArray(payload.non_goals)
    ? (payload.non_goals as unknown[])
        .map((item) => stringOrEmpty(item))
        .filter((s) => s.length > 0)
    : [];

  const constraintsArray = Array.isArray(payload.constraints)
    ? (payload.constraints as unknown[])
        .map((item) => stringOrEmpty(item))
        .filter((s) => s.length > 0)
    : [];

  const dependenciesArray = Array.isArray(payload.dependencies)
    ? (payload.dependencies as unknown[])
        .map((item) => stringOrEmpty(item))
        .filter((s) => s.length > 0)
    : [];

  const openQuestionsArray = Array.isArray(payload.open_questions_for_stakeholders)
    ? (payload.open_questions_for_stakeholders as unknown[])
        .map((item) => stringOrEmpty(item))
        .filter((s) => s.length > 0)
    : [];

  const acceptanceCriteriaLines: string[] = [];
  if (Array.isArray(payload.acceptance_criteria)) {
    for (const acRaw of payload.acceptance_criteria as unknown[]) {
      const ac = acRaw as {
        id?: string;
        description?: string;
        must_have?: boolean;
      };
      const id = stringOrEmpty(ac.id);
      const description = stringOrEmpty(ac.description);
      const mustHave = typeof ac.must_have === "boolean" ? ac.must_have : true;
      acceptanceCriteriaLines.push(
        `- [${id || "AC?"}] (must_have=${mustHave}) ${description}`,
      );
    }
  }

  return [
    `Previous run_id: ${envelope.run_id}`,
    title ? `Previous title: ${title}` : "",
    "",
    "Previous raw description (from previous requirements.source.raw_description):",
    rawDescriptionFromPrev || "(not provided)",
    "",
    "Previous problem statement:",
    problem || "(not provided)",
    "",
    "Previous goal statement:",
    goal || "(not provided)",
    "",
    "Previous context summary:",
    context || "(not provided)",
    "",
    ...(nonGoalsArray.length > 0
      ? ["Previous non-goals:", ...nonGoalsArray.map((item) => `- ${item}`), ""]
      : []),
    ...(constraintsArray.length > 0
      ? ["Previous constraints:", ...constraintsArray.map((item) => `- ${item}`), ""]
      : []),
    ...(dependenciesArray.length > 0
      ? [
          "Previous dependencies:",
          ...dependenciesArray.map((item) => `- ${item}`),
          "",
        ]
      : []),
    ...(acceptanceCriteriaLines.length > 0
      ? ["Previous acceptance criteria:", ...acceptanceCriteriaLines, ""]
      : []),
    ...(openQuestionsArray.length > 0
      ? [
          "Previous open questions for stakeholders:",
          ...openQuestionsArray.map((item) => `- ${item}`),
          "",
        ]
      : []),
    ...(freeformNotes
      ? ["Previous freeform_notes:", freeformNotes, ""]
      : []),
  ].filter((line) => line !== "");
}

function buildRequirementsPrompt(options: RequirementsRunOptions): string {
  const header = [
    "You are the Request Owner (Product Manager) agent in a multi-stage delivery pipeline.",
    "You receive a raw ticket description and must respond with a JSON object that matches the AgentOutputEnvelope and RequirementsPayload specification.",
    "Project context lives in the working directory under ./.autoworker/; you may search/read it as needed.",
    "",
    "CRITICAL:",
    "- Respond with JSON only, no surrounding text.",
    "- agent_role MUST be exactly \"Request Owner (Product Manager)\".",
    "- payload_type MUST be \"requirements\".",
    "- ticket_id MUST match the provided ticket id.",
    "- payload MUST follow RequirementsPayload, including title, problem_statement, goal_statement, acceptance_criteria, and constraints.",
    "",
  ];

  const ticketSection = [
    `Ticket id: ${options.ticketId}`,
    "",
    "Raw ticket description:",
    options.rawTicketDescription,
    "",
  ];

  const previousRequirementsSection =
    options.previousRequirements && options.previousRequirements.payload_type === "requirements"
      ? [
          "Previous requirements (baseline to revise):",
          ...summarizePreviousRequirements(options.previousRequirements),
          "",
        ]
      : [];

  const feedbackHistory = Array.isArray(options.requirementsFeedbackHistory)
    ? options.requirementsFeedbackHistory
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter((item) => item.length > 0)
    : [];

  const feedbackHistorySection =
    feedbackHistory.length > 0
      ? [
          "Feedback notes from controller/human (chronological):",
          ...feedbackHistory.map((note, index) => `${index + 1}. ${note}`),
          "",
        ]
      : [];

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
    "- Write a clear, action-oriented title under 100 characters.",
    "- Fill problem_statement and goal_statement in simple, testable language.",
    "- Derive 3-8 acceptance_criteria with ids like AC1, AC2, marked must_have where appropriate.",
    "- If revising prior requirements, keep acceptance criteria ids stable where possible.",
    "- If feedback answers previous open questions, incorporate it and remove those questions; keep any still-open questions listed.",
    "- Capture important constraints, dependencies, and non_goals that affect scope.",
    "- Use source.raw_description to store the original or lightly cleaned ticket text.",
  ];

  return [
    ...header,
    ...ticketSection,
    ...previousRequirementsSection,
    ...feedbackHistorySection,
    ...notesSection,
    ...guidance,
  ].join("\n");
}
