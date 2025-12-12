import type {
  AgentOutputEnvelopeExecutionResult,
  AgentOutputEnvelopePlan,
  AgentOutputEnvelopeQaReport,
  AgentOutputEnvelopeRequirements,
  ProjectRecord,
  TicketRecord,
} from "../models/domainTypes.js";

export interface AgentRunRecord {
  id: string;
  envelope:
    | AgentOutputEnvelopeRequirements
    | AgentOutputEnvelopePlan
    | AgentOutputEnvelopeExecutionResult
    | AgentOutputEnvelopeQaReport;
  raw: unknown;
  storedAt: string;
}

export interface ProjectUpsertInput {
  name?: string;
  workingDirectory?: string;
}

export type TicketFeedbackKind = "requirements" | "plan" | "execution" | "qa";

export interface StorageAdapter {
  listProjects(): ProjectRecord[];
  getProject(projectId: string): ProjectRecord | undefined;
  upsertProject(projectId: string, input: ProjectUpsertInput): ProjectRecord;

  upsertTicket(
    ticketId: string,
    options?: { projectId?: string },
  ): TicketRecord;
  listTickets(): TicketRecord[];
  getTicket(ticketId: string): TicketRecord | undefined;
  appendTicketFeedback(
    ticketId: string,
    kind: TicketFeedbackKind,
    note: string,
  ): TicketRecord;

  recordRequirements(envelope: AgentOutputEnvelopeRequirements): TicketRecord;
  recordPlan(envelope: AgentOutputEnvelopePlan): TicketRecord;
  recordExecutionResult(
    envelope: AgentOutputEnvelopeExecutionResult,
  ): TicketRecord;
  recordQaReport(envelope: AgentOutputEnvelopeQaReport): TicketRecord;

  listRuns(): AgentRunRecord[];
  getRun(id: string): AgentRunRecord | undefined;
}

