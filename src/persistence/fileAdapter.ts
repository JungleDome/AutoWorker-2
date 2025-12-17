import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
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

function encodeId(id: string): string {
  return encodeURIComponent(id);
}

function readJsonFile<T>(filePath: string): T | undefined {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") return undefined;
    }
    throw error;
  }
}

function writeFileAtomic(filePath: string, contents: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${randomUUID()}.tmp`;
  fs.writeFileSync(tempPath, contents, "utf8");

  try {
    fs.renameSync(tempPath, filePath);
    return;
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "EEXIST" || code === "EPERM") {
        try {
          fs.unlinkSync(filePath);
        } catch (unlinkError) {
          if (unlinkError instanceof Error && "code" in unlinkError) {
            const unlinkCode = (unlinkError as NodeJS.ErrnoException).code;
            if (unlinkCode !== "ENOENT") throw unlinkError;
          }
        }
        fs.renameSync(tempPath, filePath);
        return;
      }
    }
    throw error;
  }
}

function writeJsonFile(filePath: string, value: unknown) {
  writeFileAtomic(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function formatId(prefix: "T" | "A", year: number, seq: number): string {
  return `${prefix}-${year}-${String(seq).padStart(4, "0")}`;
}

function listJsonFiles(dirPath: string): string[] {
  try {
    return fs
      .readdirSync(dirPath, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => path.join(dirPath, entry.name));
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") return [];
    }
    throw error;
  }
}

export interface FileAdapterOptions {
  rootDir: string;
}

export function createFileAdapter(options: FileAdapterOptions): StorageAdapter {
  const rootDir = options.rootDir;
  const projectsDir = path.join(rootDir, "projects");
  const ticketsDir = path.join(rootDir, "tickets");
  const asksDir = path.join(rootDir, "asks");
  const runsDir = path.join(rootDir, "runs");
  const seqFilePath = path.join(rootDir, "seq.json");

  fs.mkdirSync(projectsDir, { recursive: true });
  fs.mkdirSync(ticketsDir, { recursive: true });
  fs.mkdirSync(asksDir, { recursive: true });
  fs.mkdirSync(runsDir, { recursive: true });

  function projectPath(projectId: string): string {
    return path.join(projectsDir, `${encodeId(projectId)}.json`);
  }

  function ticketPath(ticketId: string): string {
    return path.join(ticketsDir, `${encodeId(ticketId)}.json`);
  }

  function runPath(runId: string): string {
    return path.join(runsDir, `${encodeId(runId)}.json`);
  }

  function ensureDefaultProject(): ProjectRecord {
    const existing = readJsonFile<ProjectRecord>(projectPath("default"));
    if (existing) return existing;

    const created: ProjectRecord = {
      projectId: "default",
      name: "Default",
      workingDirectory: process.env.CODEX_WORKDIR ?? process.cwd(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    writeJsonFile(projectPath(created.projectId), created);
    return created;
  }

  function readSequence(): { year: number; ticket: number; ask: number } {
    const year = new Date().getUTCFullYear();
    const existing = readJsonFile<{ year: number; ticket: number; ask: number }>(
      seqFilePath,
    );
    if (!existing || existing.year !== year) {
      const fresh = { year, ticket: 1, ask: 1 };
      writeJsonFile(seqFilePath, fresh);
      return fresh;
    }
    return existing;
  }

  function nextId(kind: "ticket" | "ask"): string {
    const state = readSequence();
    const id =
      kind === "ticket"
        ? formatId("T", state.year, state.ticket)
        : formatId("A", state.year, state.ask);

    if (kind === "ticket") {
      state.ticket += 1;
    } else {
      state.ask += 1;
    }
    writeJsonFile(seqFilePath, state);
    return id;
  }

  function upsertTicket(
    ticketId: string,
    options?: { projectId?: string },
  ): TicketRecord {
    ensureDefaultProject();

    const filePath = ticketPath(ticketId);
    const existing = readJsonFile<TicketRecord>(filePath);
    if (existing) {
      if (options?.projectId && existing.projectId !== options.projectId) {
        existing.projectId = options.projectId;
      }
      existing.updatedAt = nowIso();
      writeJsonFile(filePath, existing);
      return existing;
    }

    const projectId = options?.projectId ?? ticketId;
    const projectFilePath = projectPath(projectId);
    const existingProject = readJsonFile<ProjectRecord>(projectFilePath);
    if (!existingProject) {
      const createdProject: ProjectRecord = {
        projectId,
        name: projectId,
        workingDirectory: process.env.CODEX_WORKDIR ?? process.cwd(),
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      writeJsonFile(projectFilePath, createdProject);
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
    writeJsonFile(filePath, created);
    return created;
  }

  function askProjectDir(projectId: string): string {
    return path.join(asksDir, encodeId(projectId));
  }

  function askPath(projectId: string, askId: string): string {
    return path.join(askProjectDir(projectId), `${encodeId(askId)}.json`);
  }

  function appendTicketFeedback(
    ticketId: string,
    kind: TicketFeedbackKind,
    note: string,
  ): TicketRecord {
    const ticket = upsertTicket(ticketId);
    ticket.feedback[kind].push(note);
    ticket.updatedAt = nowIso();
    writeJsonFile(ticketPath(ticketId), ticket);
    return ticket;
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
    writeJsonFile(runPath(id), record);
  }

  return {
    listProjects() {
      ensureDefaultProject();
      return listJsonFiles(projectsDir)
        .map((filePath) => {
          try {
            return readJsonFile<ProjectRecord>(filePath);
          } catch (error) {
            console.warn(`Failed to read project file: ${filePath}`, error);
            return undefined;
          }
        })
        .filter((value): value is ProjectRecord => value != null);
    },
    getProject(projectId: string) {
      ensureDefaultProject();
      return readJsonFile<ProjectRecord>(projectPath(projectId));
    },
    upsertProject(projectId: string, input: ProjectUpsertInput) {
      ensureDefaultProject();

      const filePath = projectPath(projectId);
      const existing = readJsonFile<ProjectRecord>(filePath);
      if (existing) {
        if (typeof input.name === "string") {
          existing.name = input.name;
        }
        if (typeof input.workingDirectory === "string") {
          existing.workingDirectory = input.workingDirectory;
        }
        existing.updatedAt = nowIso();
        writeJsonFile(filePath, existing);
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
      writeJsonFile(filePath, created);
      return created;
    },

    createTicket(projectId: string) {
      ensureDefaultProject();
      const ticketId = nextId("ticket");
      return upsertTicket(ticketId, { projectId });
    },
    upsertTicket,
    listTickets() {
      return listJsonFiles(ticketsDir)
        .map((filePath) => {
          try {
            return readJsonFile<TicketRecord>(filePath);
          } catch (error) {
            console.warn(`Failed to read ticket file: ${filePath}`, error);
            return undefined;
          }
        })
        .filter((value): value is TicketRecord => value != null);
    },
    getTicket(ticketId: string) {
      return readJsonFile<TicketRecord>(ticketPath(ticketId));
    },
    getTicketForProject(projectId: string, ticketId: string) {
      const ticket = readJsonFile<TicketRecord>(ticketPath(ticketId));
      if (!ticket) return undefined;
      return ticket.projectId === projectId ? ticket : undefined;
    },
    appendTicketFeedback,

    recordRequirements(envelope: AgentOutputEnvelopeRequirements) {
      const ticket = upsertTicket(envelope.ticket_id);
      ticket.latestRequirements = envelope;
      ticket.updatedAt = nowIso();
      writeJsonFile(ticketPath(ticket.ticketId), ticket);
      persistRun(envelope);
      return ticket;
    },
    recordPlan(envelope: AgentOutputEnvelopePlan) {
      const ticket = upsertTicket(envelope.ticket_id);
      ticket.latestPlan = envelope;
      ticket.planHistory.push(envelope);
      ticket.updatedAt = nowIso();
      writeJsonFile(ticketPath(ticket.ticketId), ticket);
      persistRun(envelope);
      return ticket;
    },
    recordExecutionResult(envelope: AgentOutputEnvelopeExecutionResult) {
      const ticket = upsertTicket(envelope.ticket_id);
      ticket.executionResults.push(envelope);
      ticket.updatedAt = nowIso();
      writeJsonFile(ticketPath(ticket.ticketId), ticket);
      persistRun(envelope);
      return ticket;
    },
    recordQaReport(envelope: AgentOutputEnvelopeQaReport) {
      const ticket = upsertTicket(envelope.ticket_id);
      ticket.qaReports.push(envelope);
      ticket.updatedAt = nowIso();
      writeJsonFile(ticketPath(ticket.ticketId), ticket);
      persistRun(envelope);
      return ticket;
    },

    createAsk(projectId: string, question: string) {
      ensureDefaultProject();
      const askId = nextId("ask");
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
      writeJsonFile(askPath(projectId, askId), created);
      return created;
    },
    listAsks(projectId: string) {
      ensureDefaultProject();
      return listJsonFiles(askProjectDir(projectId))
        .map((filePath) => {
          try {
            return readJsonFile<AskRecord>(filePath);
          } catch (error) {
            console.warn(`Failed to read ask file: ${filePath}`, error);
            return undefined;
          }
        })
        .filter((value): value is AskRecord => value != null);
    },
    getAsk(projectId: string, askId: string) {
      ensureDefaultProject();
      return readJsonFile<AskRecord>(askPath(projectId, askId));
    },
    answerAsk(projectId: string, askId: string, answer: string) {
      ensureDefaultProject();
      const ask = readJsonFile<AskRecord>(askPath(projectId, askId));
      if (!ask) {
        throw new Error(`Ask not found: ${projectId}/${askId}`);
      }
      ask.answer = answer;
      ask.updatedAt = nowIso();
      writeJsonFile(askPath(projectId, askId), ask);
      return ask;
    },

    listRuns() {
      return listJsonFiles(runsDir)
        .map((filePath) => {
          try {
            return readJsonFile<AgentRunRecord>(filePath);
          } catch (error) {
            console.warn(`Failed to read run file: ${filePath}`, error);
            return undefined;
          }
        })
        .filter((value): value is AgentRunRecord => value != null);
    },
    getRun(id: string) {
      return readJsonFile<AgentRunRecord>(runPath(id));
    },
  };
}
