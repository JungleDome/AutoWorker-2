import * as path from "node:path";
import {
  createInMemoryAdapter,
} from "./persistence/inMemoryAdapter.js";
import { createFileAdapter } from "./persistence/fileAdapter.js";
import type {
  AgentRunRecord,
  ProjectUpsertInput,
  StorageAdapter,
  TicketFeedbackKind,
} from "./persistence/storageAdapter.js";
import type {
  AgentOutputEnvelopeExecutionResult,
  AgentOutputEnvelopePlan,
  AgentOutputEnvelopeQaReport,
  AgentOutputEnvelopeRequirements,
  ProjectRecord,
  TicketRecord,
} from "./models/domainTypes.js";

export type { AgentRunRecord, ProjectUpsertInput, TicketFeedbackKind };

function createStorageAdapterFromEnv(): StorageAdapter {
  const backend = (process.env.TICKET_STORAGE ?? "file").toLowerCase();

  if (backend === "memory" || backend === "inmemory" || backend === "in-memory") {
    return createInMemoryAdapter();
  }

  const rootDir = process.env.TICKET_STORAGE_DIR
    ? path.resolve(process.env.TICKET_STORAGE_DIR)
    : path.resolve(process.cwd(), "docs_ticket");

  return createFileAdapter({ rootDir });
}

const adapter = createStorageAdapterFromEnv();

export function listProjects(): ProjectRecord[] {
  return adapter.listProjects();
}

export function getProject(projectId: string): ProjectRecord | undefined {
  return adapter.getProject(projectId);
}

export function upsertProject(
  projectId: string,
  input: ProjectUpsertInput,
): ProjectRecord {
  return adapter.upsertProject(projectId, input);
}

export function upsertTicket(
  ticketId: string,
  options?: { projectId?: string },
): TicketRecord {
  return adapter.upsertTicket(ticketId, options);
}

export function listTickets(): TicketRecord[] {
  return adapter.listTickets();
}

export function getTicket(ticketId: string): TicketRecord | undefined {
  return adapter.getTicket(ticketId);
}

export function appendTicketFeedback(
  ticketId: string,
  kind: TicketFeedbackKind,
  note: string,
): TicketRecord {
  return adapter.appendTicketFeedback(ticketId, kind, note);
}

export function recordRequirements(
  envelope: AgentOutputEnvelopeRequirements,
): TicketRecord {
  return adapter.recordRequirements(envelope);
}

export function recordPlan(envelope: AgentOutputEnvelopePlan): TicketRecord {
  return adapter.recordPlan(envelope);
}

export function recordExecutionResult(
  envelope: AgentOutputEnvelopeExecutionResult,
): TicketRecord {
  return adapter.recordExecutionResult(envelope);
}

export function recordQaReport(envelope: AgentOutputEnvelopeQaReport): TicketRecord {
  return adapter.recordQaReport(envelope);
}

export function listRuns(): AgentRunRecord[] {
  return adapter.listRuns();
}

export function getRun(id: string): AgentRunRecord | undefined {
  return adapter.getRun(id);
}
