import { randomUUID } from "node:crypto";
import type {
  AgentOutputEnvelope,
  ExecutionResultPayload,
  PlanPayload,
  QaReportPayload,
  RequirementsPayload,
  TicketRecord,
} from "./models/domainTypes.js";

export interface AgentRunRecord {
  id: string;
  envelope:
    | AgentOutputEnvelope<RequirementsPayload>
    | AgentOutputEnvelope<PlanPayload>
    | AgentOutputEnvelope<ExecutionResultPayload>
    | AgentOutputEnvelope<QaReportPayload>;
  raw: unknown;
  storedAt: string;
}

const tickets = new Map<string, TicketRecord>();
const runs = new Map<string, AgentRunRecord>();

function nowIso(): string {
  return new Date().toISOString();
}

export function upsertTicket(ticketId: string): TicketRecord {
  const existing = tickets.get(ticketId);
  if (existing) {
    existing.updatedAt = nowIso();
    return existing;
  }

  const created: TicketRecord = {
    ticketId,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    planHistory: [],
    executionResults: [],
    qaReports: [],
    feedback: {
      requirements: [],
      plan: [],
      execution: [],
      qa: [],
    },
  };
  tickets.set(ticketId, created);
  return created;
}

export function listTickets(): TicketRecord[] {
  return Array.from(tickets.values());
}

export function getTicket(ticketId: string): TicketRecord | undefined {
  return tickets.get(ticketId);
}

export function recordRequirements(envelope: AgentOutputEnvelope<RequirementsPayload>): TicketRecord {
  const ticket = upsertTicket(envelope.ticket_id);
  ticket.latestRequirements = envelope;
  ticket.updatedAt = nowIso();
  persistRun(envelope);
  return ticket;
}

export function recordPlan(envelope: AgentOutputEnvelope<PlanPayload>): TicketRecord {
  const ticket = upsertTicket(envelope.ticket_id);
  ticket.latestPlan = envelope;
  ticket.planHistory.push(envelope);
  ticket.updatedAt = nowIso();
  persistRun(envelope);
  return ticket;
}

export function recordExecutionResult(envelope: AgentOutputEnvelope<ExecutionResultPayload>): TicketRecord {
  const ticket = upsertTicket(envelope.ticket_id);
  ticket.executionResults.push(envelope);
  ticket.updatedAt = nowIso();
  persistRun(envelope);
  return ticket;
}

export function recordQaReport(envelope: AgentOutputEnvelope<QaReportPayload>): TicketRecord {
  const ticket = upsertTicket(envelope.ticket_id);
  ticket.qaReports.push(envelope);
  ticket.updatedAt = nowIso();
  persistRun(envelope);
  return ticket;
}

export function listRuns(): AgentRunRecord[] {
  return Array.from(runs.values());
}

export function getRun(id: string): AgentRunRecord | undefined {
  return runs.get(id);
}

function persistRun(
  envelope:
    | AgentOutputEnvelope<RequirementsPayload>
    | AgentOutputEnvelope<PlanPayload>
    | AgentOutputEnvelope<ExecutionResultPayload>
    | AgentOutputEnvelope<QaReportPayload>,
) {
  const id = randomUUID();
  const record: AgentRunRecord = {
    id,
    envelope,
    raw: envelope,
    storedAt: nowIso(),
  };
  runs.set(id, record);
}
