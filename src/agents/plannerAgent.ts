import { Codex, type ApprovalMode, type SandboxMode } from "@openai/codex-sdk";
import { config } from "../config.js";
import type { AgentOutputEnvelope, AgentRole, PlanPayload, RequirementsPayload } from "../models/domainTypes.js";
import { recordPlan } from "../storage.js";

const PLANNER_ROLE: AgentRole = "Planner (Tech Lead)";

const codex = new Codex();

export interface PlannerRunOptions {
  ticketId: string;
  requirements: AgentOutputEnvelope<RequirementsPayload>;
  notesForAgent?: string;
}

export async function runPlannerForTicket(options: PlannerRunOptions): Promise<AgentOutputEnvelope<PlanPayload>> {
  const thread = codex.startThread({
    model: config.codex.model,
    sandboxMode: config.codex.sandboxMode as SandboxMode | undefined,
    approvalPolicy: config.codex.approvalPolicy as ApprovalMode | undefined,
    workingDirectory: config.codex.workingDirectory ?? process.cwd(),
    skipGitRepoCheck: true,
    networkAccessEnabled: config.codex.networkAccessEnabled,
    webSearchEnabled: config.codex.webSearchEnabled,
  });

  const instructions = buildPlannerPrompt(options);

  const turn = await thread.run(instructions);

  let envelope: AgentOutputEnvelope<PlanPayload>;
  try {
    envelope = JSON.parse(turn.finalResponse) as AgentOutputEnvelope<PlanPayload>;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown parse error";
    throw new Error(`Failed to parse planner output as JSON: ${message}`);
  }

  if (envelope.payload_type !== "plan") {
    throw new Error(`Planner must return payload_type="plan", got "${envelope.payload_type}"`);
  }
  if (envelope.agent_role !== PLANNER_ROLE) {
    throw new Error(`Planner must return agent_role="${PLANNER_ROLE}", got "${envelope.agent_role}"`);
  }
  if (envelope.ticket_id !== options.ticketId) {
    throw new Error(`Planner returned ticket_id="${envelope.ticket_id}" but expected "${options.ticketId}"`);
  }

  recordPlan(envelope);

  return envelope;
}

function stringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function buildPlannerPrompt(options: PlannerRunOptions): string {
  const req = options.requirements.payload as RequirementsPayload & {
    title?: string;
    problem_statement?: string;
    goal_statement?: string;
    non_goals?: unknown;
    context_summary?: string;
    constraints?: unknown;
    acceptance_criteria?: unknown;
    dependencies?: unknown;
    freeform_notes?: string;
    source?: { raw_description?: string };
  };

  const title = stringOrEmpty(req.title);
  const problem = stringOrEmpty(req.problem_statement);
  const goal = stringOrEmpty(req.goal_statement);
  const context = stringOrEmpty(req.context_summary);
  const freeformNotes = stringOrEmpty(req.freeform_notes);

  const rawDescription = req.source ? stringOrEmpty(req.source.raw_description) : "";

  const nonGoalsArray = Array.isArray(req.non_goals)
    ? (req.non_goals as unknown[]).map((item) => stringOrEmpty(item)).filter((s) => s.length > 0)
    : [];

  const constraintsArray = Array.isArray(req.constraints)
    ? (req.constraints as unknown[]).map((item) => stringOrEmpty(item)).filter((s) => s.length > 0)
    : [];

  const dependenciesArray = Array.isArray(req.dependencies)
    ? (req.dependencies as unknown[]).map((item) => stringOrEmpty(item)).filter((s) => s.length > 0)
    : [];

  const acceptanceCriteriaLines: string[] = [];
  if (Array.isArray(req.acceptance_criteria)) {
    for (const acRaw of req.acceptance_criteria as unknown[]) {
      const ac = acRaw as {
        id?: string;
        description?: string;
        must_have?: boolean;
      };
      const id = stringOrEmpty(ac.id);
      const description = stringOrEmpty(ac.description);
      const mustHave = typeof ac.must_have === "boolean" ? ac.must_have : true;
      acceptanceCriteriaLines.push(`- [${id || "AC?"}] (must_have=${mustHave}) ${description}`);
    }
  }

  const header = [
    "You are the Planner (Tech Lead) agent in a multi-stage delivery pipeline.",
    "You receive structured requirements for a single ticket and must respond with a JSON object that matches the AgentOutputEnvelope and PlanPayload specification.",
    "",
    "CRITICAL:",
    "- Respond with JSON only, no surrounding text.",
    '- agent_role MUST be exactly "Planner (Tech Lead)".',
    '- payload_type MUST be "plan".',
    "- ticket_id MUST match the provided ticket id.",
    "- payload MUST follow PlanPayload, including steps with dependencies and children.",
    "",
  ];

  const ticketSection = [
    `Ticket id: ${options.ticketId}`,
    title ? `Requirements title: ${title}` : "",
    "",
    "Raw description (from requirements.source.raw_description):",
    rawDescription || "(not provided)",
    "",
    "Problem statement:",
    problem || "(not provided)",
    "",
    "Goal statement:",
    goal || "(not provided)",
    "",
  ];

  const contextSection = ["Context summary:", context || "(not provided)", ""];

  const nonGoalsSection = nonGoalsArray.length > 0 ? ["Non-goals / out-of-scope items:", ...nonGoalsArray.map((item) => `- ${item}`), ""] : [];

  const constraintsSection = constraintsArray.length > 0 ? ["Constraints:", ...constraintsArray.map((item) => `- ${item}`), ""] : [];

  const dependenciesSection =
    dependenciesArray.length > 0 ? ["Dependencies (other tickets/work items):", ...dependenciesArray.map((item) => `- ${item}`), ""] : [];

  const acSection = acceptanceCriteriaLines.length > 0 ? ["Acceptance criteria:", ...acceptanceCriteriaLines, ""] : [];

  const notesFromRequirementsSection = freeformNotes ? ["Additional notes from requirements.freeform_notes:", freeformNotes, ""] : [];

  const humanNotesSection =
    options.notesForAgent && options.notesForAgent.trim().length > 0
      ? ["Additional notes or feedback from controller/human:", options.notesForAgent, ""]
      : [];

  const guidance = [
    "Guidance:",
    "- Create 3–10 top-level steps with nested children where helpful.",
    "- Use depends_on to encode ordering constraints between step ids.",
    '- Set status to "pending" for all executable steps in the initial plan.',
    "- Carefully fill risk_level, requires_review, and owner_role for each step.",
    "- Map steps back to acceptance criteria ids where possible using related_acceptance_criteria.",
  ];

  return [
    ...header,
    ...ticketSection,
    ...contextSection,
    ...nonGoalsSection,
    ...constraintsSection,
    ...dependenciesSection,
    ...acSection,
    ...notesFromRequirementsSection,
    ...humanNotesSection,
    ...guidance,
  ]
    .filter((line) => line !== "")
    .join("\n");
}
