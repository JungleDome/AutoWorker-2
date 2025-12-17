import * as path from "node:path";
import {
  createInMemoryAdapter,
} from "./persistence/inMemoryAdapter.js";
import { createFileAdapter } from "./persistence/fileAdapter.js";
import { createVaultAdapter } from "./persistence/vaultAdapter.js";
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
  AskRecord,
  ProjectRecord,
  TicketRecord,
} from "./models/domainTypes.js";

export type { AgentRunRecord, ProjectUpsertInput, TicketFeedbackKind };

function createStorageAdapterFromEnv(): StorageAdapter {
  const backend = (process.env.TICKET_STORAGE ?? "vault").toLowerCase();

  if (backend === "memory" || backend === "inmemory" || backend === "in-memory") {
    return createInMemoryAdapter();
  }

  if (backend === "vault" || backend === "colocated" || backend === "co-located") {
    const rootDir = process.env.TICKET_STORAGE_DIR
      ? path.resolve(process.env.TICKET_STORAGE_DIR)
      : path.resolve(process.cwd(), "docs_ticket");

    return createVaultAdapter({ rootDir, vaultDirName: ".autoworker" });
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

export function createTicket(projectId: string): TicketRecord {
  return adapter.createTicket(projectId);
}

export function listTickets(): TicketRecord[] {
  return adapter.listTickets();
}

export function getTicket(ticketId: string): TicketRecord | undefined {
  return adapter.getTicket(ticketId);
}

export function getTicketForProject(
  projectId: string,
  ticketId: string,
): TicketRecord | undefined {
  return adapter.getTicketForProject(projectId, ticketId);
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

export function createAsk(projectId: string, question: string): AskRecord {
  return adapter.createAsk(projectId, question);
}

export function listAsks(projectId: string): AskRecord[] {
  return adapter.listAsks(projectId);
}

export function getAsk(projectId: string, askId: string): AskRecord | undefined {
  return adapter.getAsk(projectId, askId);
}

export function answerAsk(
  projectId: string,
  askId: string,
  answer: string,
): AskRecord {
  return adapter.answerAsk(projectId, askId, answer);
}

export function listRuns(): AgentRunRecord[] {
  return adapter.listRuns();
}

export function getRun(id: string): AgentRunRecord | undefined {
  return adapter.getRun(id);
}
