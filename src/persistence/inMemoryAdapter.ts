import { randomUUID } from "node:crypto";
import type {
  AgentOutputEnvelopeExecutionResult,
  AgentOutputEnvelopePlan,
  AgentOutputEnvelopeQaReport,
  AgentOutputEnvelopeRequirements,
  ProjectRecord,
  TicketRecord,
} from "../models/domainTypes.js";
import type {
  AgentRunRecord,
  ProjectUpsertInput,
  StorageAdapter,
  TicketFeedbackKind,
} from "./storageAdapter.js";

function nowIso(): string {
  return new Date().toISOString();
}

export function createInMemoryAdapter(): StorageAdapter {
  const tickets = new Map<string, TicketRecord>();
  const runs = new Map<string, AgentRunRecord>();
  const projects = new Map<string, ProjectRecord>();

  function ensureDefaultProject(): ProjectRecord {
    const existing = projects.get("default");
    if (existing) return existing;

    const created: ProjectRecord = {
      projectId: "default",
      name: "Default",
      workingDirectory: process.env.CODEX_WORKDIR ?? process.cwd(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    projects.set(created.projectId, created);
    return created;
  }

  function persistRun(
    envelope:
      | AgentOutputEnvelopeRequirements
      | AgentOutputEnvelopePlan
      | AgentOutputEnvelopeExecutionResult
      | AgentOutputEnvelopeQaReport,
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

  function upsertTicket(
    ticketId: string,
    options?: { projectId?: string },
  ): TicketRecord {
    ensureDefaultProject();

    const existing = tickets.get(ticketId);
    if (existing) {
      if (options?.projectId && existing.projectId !== options.projectId) {
        existing.projectId = options.projectId;
      }
      existing.updatedAt = nowIso();
      return existing;
    }

    const projectId = options?.projectId ?? ticketId;
    if (!projects.has(projectId)) {
      projects.set(projectId, {
        projectId,
        name: projectId,
        workingDirectory: process.env.CODEX_WORKDIR ?? process.cwd(),
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
    }

    const created: TicketRecord = {
      ticketId,
      projectId,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      latestRequirements: null,
      latestPlan: null,
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

  function appendTicketFeedback(
    ticketId: string,
    kind: TicketFeedbackKind,
    note: string,
  ): TicketRecord {
    const ticket = upsertTicket(ticketId);
    ticket.feedback[kind].push(note);
    ticket.updatedAt = nowIso();
    return ticket;
  }

  return {
    listProjects() {
      ensureDefaultProject();
      return Array.from(projects.values());
    },
    getProject(projectId: string) {
      ensureDefaultProject();
      return projects.get(projectId);
    },
    upsertProject(projectId: string, input: ProjectUpsertInput) {
      ensureDefaultProject();

      const existing = projects.get(projectId);
      if (existing) {
        if (typeof input.name === "string") {
          existing.name = input.name;
        }
        if (typeof input.workingDirectory === "string") {
          existing.workingDirectory = input.workingDirectory;
        }
        existing.updatedAt = nowIso();
        return existing;
      }

      const created: ProjectRecord = {
        projectId,
        name: input.name ?? projectId,
        workingDirectory:
          input.workingDirectory ?? process.env.CODEX_WORKDIR ?? process.cwd(),
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      projects.set(projectId, created);
      return created;
    },

    upsertTicket,
    listTickets() {
      return Array.from(tickets.values());
    },
    getTicket(ticketId: string) {
      return tickets.get(ticketId);
    },
    appendTicketFeedback,

    recordRequirements(envelope: AgentOutputEnvelopeRequirements) {
      const ticket = upsertTicket(envelope.ticket_id);
      ticket.latestRequirements = envelope;
      ticket.updatedAt = nowIso();
      persistRun(envelope);
      return ticket;
    },
    recordPlan(envelope: AgentOutputEnvelopePlan) {
      const ticket = upsertTicket(envelope.ticket_id);
      ticket.latestPlan = envelope;
      ticket.planHistory.push(envelope);
      ticket.updatedAt = nowIso();
      persistRun(envelope);
      return ticket;
    },
    recordExecutionResult(envelope: AgentOutputEnvelopeExecutionResult) {
      const ticket = upsertTicket(envelope.ticket_id);
      ticket.executionResults.push(envelope);
      ticket.updatedAt = nowIso();
      persistRun(envelope);
      return ticket;
    },
    recordQaReport(envelope: AgentOutputEnvelopeQaReport) {
      const ticket = upsertTicket(envelope.ticket_id);
      ticket.qaReports.push(envelope);
      ticket.updatedAt = nowIso();
      persistRun(envelope);
      return ticket;
    },

    listRuns() {
      return Array.from(runs.values());
    },
    getRun(id: string) {
      return runs.get(id);
    },
  };
}
