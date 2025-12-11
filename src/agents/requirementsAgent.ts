import { Codex, type ApprovalMode, type SandboxMode } from "@openai/codex-sdk";
import { config } from "../config.js";
import type { AgentOutputEnvelope, AgentRole, RequirementsPayload } from "../models/domainTypes.js";
import { recordRequirements } from "../storage.js";

const REQUIREMENTS_ROLE: AgentRole = "Request Owner (Product Manager)";

const codex = new Codex();

export interface RequirementsRunOptions {
  ticketId: string;
  rawTicketDescription: string;
  notesForAgent?: string;
}

export async function runRequirementsForTicket(options: RequirementsRunOptions): Promise<AgentOutputEnvelope<RequirementsPayload>> {
  const thread = codex.startThread({
    model: config.codex.model,
    sandboxMode: config.codex.sandboxMode as SandboxMode | undefined,
    approvalPolicy: config.codex.approvalPolicy as ApprovalMode | undefined,
    workingDirectory: config.codex.workingDirectory ?? process.cwd(),
    skipGitRepoCheck: true,
    networkAccessEnabled: config.codex.networkAccessEnabled,
    webSearchEnabled: config.codex.webSearchEnabled,
  });

  const instructions = buildRequirementsPrompt(options);

  const turn = await thread.run(instructions);

  let envelope: AgentOutputEnvelope<RequirementsPayload>;
  try {
    envelope = JSON.parse(turn.finalResponse) as AgentOutputEnvelope<RequirementsPayload>;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown parse error";
    throw new Error(`Failed to parse requirements output as JSON: ${message}`);
  }

  if (envelope.payload_type !== "requirements") {
    throw new Error(`Requirements agent must return payload_type="requirements", got "${envelope.payload_type}"`);
  }
  if (envelope.agent_role !== REQUIREMENTS_ROLE) {
    throw new Error(`Requirements agent must return agent_role="${REQUIREMENTS_ROLE}", got "${envelope.agent_role}"`);
  }
  if (envelope.ticket_id !== options.ticketId) {
    throw new Error(`Requirements agent returned ticket_id="${envelope.ticket_id}" but expected "${options.ticketId}"`);
  }

  recordRequirements(envelope);

  return envelope;
}

function buildRequirementsPrompt(options: RequirementsRunOptions): string {
  const header = [
    "You are the Request Owner (Product Manager) agent in a multi-stage delivery pipeline.",
    "You receive a raw ticket description and must respond with a JSON object that matches the AgentOutputEnvelope and RequirementsPayload specification.",
    "",
    "CRITICAL:",
    "- Respond with JSON only, no surrounding text.",
    '- agent_role MUST be exactly "Request Owner (Product Manager)".',
    '- payload_type MUST be "requirements".',
    "- ticket_id MUST match the provided ticket id.",
    "- payload MUST follow RequirementsPayload, including title, problem_statement, goal_statement, acceptance_criteria, and constraints.",
    "",
  ];

  const ticketSection = [`Ticket id: ${options.ticketId}`, "", "Raw ticket description:", options.rawTicketDescription, ""];

  const notesSection =
    options.notesForAgent && options.notesForAgent.trim().length > 0 ? ["Additional notes from controller/human:", options.notesForAgent, ""] : [];

  const guidance = [
    "Guidance:",
    "- Write a clear, action-oriented title under 100 characters.",
    "- Fill problem_statement and goal_statement in simple, testable language.",
    "- Derive 3-8 acceptance_criteria with ids like AC1, AC2, marked must_have where appropriate.",
    "- Capture important constraints, dependencies, and non_goals that affect scope.",
    "- Use source.raw_description to store the original or lightly cleaned ticket text.",
  ];

  return [...header, ...ticketSection, ...notesSection, ...guidance].join("\n");
}
