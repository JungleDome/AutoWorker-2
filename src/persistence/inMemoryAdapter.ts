import { randomUUID } from "node:crypto";
import type {
  AgentOutputEnvelopeExecutionResult,
  AgentOutputEnvelopePlan,
  AgentOutputEnvelopeQaReport,
  AgentOutputEnvelopeRequirements,
  AskRecord,
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
  const ticketsByProject = new Map<string, Map<string, TicketRecord>>();
  const asksByProject = new Map<string, Map<string, AskRecord>>();
  let sequenceState: { ticket: number; ask: number; year: number } | null = null;
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
      schemaVersion: 2,
      ticketId,
      projectId,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      status: "open",
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
    if (!ticketsByProject.has(projectId)) {
      ticketsByProject.set(projectId, new Map());
    }
    ticketsByProject.get(projectId)!.set(ticketId, created);
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

  function nextSequence(): { year: number; ticket: number; ask: number } {
    const year = new Date().getUTCFullYear();
    if (!sequenceState || sequenceState.year !== year) {
      sequenceState = { year, ticket: 1, ask: 1 };
    }
    return sequenceState;
  }

  function formatId(prefix: "T" | "A", year: number, seq: number): string {
    return `${prefix}-${year}-${String(seq).padStart(4, "0")}`;
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

    createTicket(projectId: string) {
      ensureDefaultProject();
      const seq = nextSequence();
      const ticketId = formatId("T", seq.year, seq.ticket++);
      return upsertTicket(ticketId, { projectId });
    },
    upsertTicket,
    listTickets() {
      return Array.from(tickets.values());
    },
    getTicket(ticketId: string) {
      return tickets.get(ticketId);
    },
    getTicketForProject(projectId: string, ticketId: string) {
      const projectTickets = ticketsByProject.get(projectId);
      return projectTickets ? projectTickets.get(ticketId) : undefined;
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

    createAsk(projectId: string, question: string) {
      ensureDefaultProject();
      const seq = nextSequence();
      const askId = formatId("A", seq.year, seq.ask++);
      const created: AskRecord = {
        schemaVersion: 1,
        askId,
        projectId,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        question,
        answer: null,
        relatedTicketIds: [],
      };
      if (!asksByProject.has(projectId)) {
        asksByProject.set(projectId, new Map());
      }
      asksByProject.get(projectId)!.set(askId, created);
      return created;
    },
    listAsks(projectId: string) {
      ensureDefaultProject();
      return Array.from(asksByProject.get(projectId)?.values() ?? []);
    },
    getAsk(projectId: string, askId: string) {
      ensureDefaultProject();
      return asksByProject.get(projectId)?.get(askId);
    },
    answerAsk(projectId: string, askId: string, answer: string) {
      const ask = asksByProject.get(projectId)?.get(askId);
      if (!ask) {
        throw new Error(`Ask not found: ${projectId}/${askId}`);
      }
      ask.answer = answer;
      ask.updatedAt = nowIso();
      return ask;
    },

    listRuns() {
      return Array.from(runs.values());
    },
    getRun(id: string) {
      return runs.get(id);
    },
  };
}
