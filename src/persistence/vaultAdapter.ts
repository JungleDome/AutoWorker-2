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

function formatId(prefix: "T" | "A", year: number, seq: number): string {
  return `${prefix}-${year}-${String(seq).padStart(4, "0")}`;
}

export interface VaultAdapterOptions {
  rootDir: string;
  vaultDirName: string;
}

type SequenceState = { year: number; ticket: number; ask: number };

export function createVaultAdapter(options: VaultAdapterOptions): StorageAdapter {
  const rootDir = options.rootDir;
  const vaultDirName = options.vaultDirName;

  const projectsDir = path.join(rootDir, "projects");
  const legacyTicketsDir = path.join(rootDir, "tickets");
  const runsDir = path.join(rootDir, "runs");
  const seqFilePath = path.join(rootDir, "seq.json");

  fs.mkdirSync(projectsDir, { recursive: true });
  fs.mkdirSync(runsDir, { recursive: true });

  function projectRegistryPath(projectId: string): string {
    return path.join(projectsDir, `${encodeId(projectId)}.json`);
  }

  function runPath(runId: string): string {
    return path.join(runsDir, `${encodeId(runId)}.json`);
  }

  function ensureDefaultProject(): ProjectRecord {
    const existing = readJsonFile<ProjectRecord>(projectRegistryPath("default"));
    if (existing) return existing;

    const created: ProjectRecord = {
      projectId: "default",
      name: "Default",
      workingDirectory: process.env.CODEX_WORKDIR ?? process.cwd(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    writeJsonFile(projectRegistryPath(created.projectId), created);
    ensureProjectVault(created);
    return created;
  }

  function migrateLegacyTicketsIfEnabled() {
    const enabled =
      typeof process.env.AUTO_WORKER_MIGRATE_LEGACY === "string" &&
      process.env.AUTO_WORKER_MIGRATE_LEGACY.toLowerCase() === "true";
    if (!enabled) return;

    const legacyFiles = listJsonFiles(legacyTicketsDir);
    if (legacyFiles.length === 0) return;

    for (const filePath of legacyFiles) {
      let legacy: TicketRecord | undefined;
      try {
        legacy = readJsonFile<TicketRecord>(filePath);
      } catch (error) {
        console.warn(`Failed to read legacy ticket file: ${filePath}`, error);
        continue;
      }
      if (!legacy) continue;

      const projectId = legacy.projectId;
      let project: ProjectRecord;
      try {
        project = getProjectOrThrow(projectId);
      } catch (error) {
        console.warn(
          `Skipping legacy ticket ${legacy.ticketId}; project not found: ${projectId}`,
          error,
        );
        continue;
      }

      ensureProjectVault(project);
      const targetPath = ticketJsonPath(project, legacy.ticketId);
      if (readJsonFile<TicketRecord>(targetPath)) {
        continue;
      }

      const migrated: TicketRecord = {
        ...legacy,
        schemaVersion: legacy.schemaVersion ?? 2,
        status: legacy.status ?? "open",
        updatedAt: legacy.updatedAt ?? nowIso(),
        createdAt: legacy.createdAt ?? nowIso(),
      };

      try {
        writeTicketAndViews(project, migrated);
      } catch (error) {
        console.warn(
          `Failed to migrate legacy ticket ${legacy.ticketId} into project ${projectId}`,
          error,
        );
      }
    }
  }

  function getProjectOrThrow(projectId: string): ProjectRecord {
    ensureDefaultProject();
    const project = readJsonFile<ProjectRecord>(projectRegistryPath(projectId));
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }
    return project;
  }

  function vaultRoot(project: ProjectRecord): string {
    return path.join(project.workingDirectory, vaultDirName);
  }

  function ticketsDir(project: ProjectRecord): string {
    return path.join(vaultRoot(project), "tickets");
  }

  function asksDir(project: ProjectRecord): string {
    return path.join(vaultRoot(project), "asks");
  }

  function ticketJsonPath(project: ProjectRecord, ticketId: string): string {
    return path.join(ticketsDir(project), `${encodeId(ticketId)}.json`);
  }

  function askJsonPath(project: ProjectRecord, askId: string): string {
    return path.join(asksDir(project), `${encodeId(askId)}.json`);
  }

  function projectIndexPath(project: ProjectRecord): string {
    return path.join(vaultRoot(project), "INDEX.md");
  }

  function ticketsIndexJsonPath(project: ProjectRecord): string {
    return path.join(ticketsDir(project), "index.json");
  }

  function ticketsIndexMdPath(project: ProjectRecord): string {
    return path.join(ticketsDir(project), "index.md");
  }

  function asksIndexJsonPath(project: ProjectRecord): string {
    return path.join(asksDir(project), "index.json");
  }

  function asksIndexMdPath(project: ProjectRecord): string {
    return path.join(asksDir(project), "index.md");
  }

  function ensureProjectVault(project: ProjectRecord) {
    fs.mkdirSync(vaultRoot(project), { recursive: true });
    fs.mkdirSync(ticketsDir(project), { recursive: true });
    fs.mkdirSync(asksDir(project), { recursive: true });

    const existingProjectFile = readJsonFile<{
      schemaVersion: number;
      projectId: string;
      createdAt: string;
      updatedAt: string;
    }>(path.join(vaultRoot(project), "project.json"));
    if (!existingProjectFile) {
      writeJsonFile(path.join(vaultRoot(project), "project.json"), {
        schemaVersion: 1,
        projectId: project.projectId,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      });
    }

    renderProjectIndex(project);
    refreshTicketsIndex(project);
    refreshAsksIndex(project);
  }

  function readSeq(): SequenceState {
    const year = new Date().getUTCFullYear();
    const state = readJsonFile<SequenceState>(seqFilePath);
    if (!state || state.year !== year) {
      const fresh: SequenceState = { year, ticket: 1, ask: 1 };
      writeJsonFile(seqFilePath, fresh);
      return fresh;
    }
    return state;
  }

  function nextId(kind: "ticket" | "ask"): string {
    const state = readSeq();
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

  function ticketDisplayTitle(ticket: TicketRecord): string {
    const payload = ticket.latestRequirements?.payload as { title?: string } | undefined;
    return payload?.title?.trim() ? payload.title.trim() : ticket.ticketId;
  }

  function renderTicketMarkdown(ticket: TicketRecord): string {
    const lines: string[] = [];
    lines.push(`# ${ticket.ticketId}`);
    lines.push("");
    lines.push(`- Project: ${ticket.projectId}`);
    lines.push(`- Status: ${ticket.status ?? "open"}`);
    lines.push(`- Updated: ${ticket.updatedAt}`);
    lines.push("");

    const req = ticket.latestRequirements?.payload as any;
    if (req) {
      lines.push("## Requirements");
      lines.push("");
      if (typeof req.title === "string") lines.push(`Title: ${req.title}`);
      if (typeof req.problem_statement === "string") {
        lines.push("");
        lines.push("Problem:");
        lines.push(req.problem_statement);
      }
      if (typeof req.goal_statement === "string") {
        lines.push("");
        lines.push("Goal:");
        lines.push(req.goal_statement);
      }
      if (Array.isArray(req.constraints) && req.constraints.length > 0) {
        lines.push("");
        lines.push("Constraints:");
        for (const c of req.constraints) lines.push(`- ${String(c)}`);
      }
      if (Array.isArray(req.acceptance_criteria) && req.acceptance_criteria.length > 0) {
        lines.push("");
        lines.push("Acceptance criteria:");
        for (const ac of req.acceptance_criteria) {
          const id = ac?.id ? String(ac.id) : "AC?";
          const desc = ac?.description ? String(ac.description) : "";
          const must = typeof ac?.must_have === "boolean" ? ac.must_have : true;
          lines.push(`- [${id}] (must_have=${must}) ${desc}`);
        }
      }
      lines.push("");
    }

    const plan = ticket.latestPlan?.payload as any;
    if (plan) {
      lines.push("## Latest plan");
      lines.push("");
      if (typeof plan.plan_id === "string") lines.push(`Plan id: ${plan.plan_id}`);
      if (typeof plan.plan_version === "number") lines.push(`Plan version: ${plan.plan_version}`);
      if (typeof plan.summary === "string") {
        lines.push("");
        lines.push(plan.summary);
      }
      lines.push("");
    }

    const lastExec = ticket.executionResults.length
      ? (ticket.executionResults[ticket.executionResults.length - 1].payload as any)
      : null;
    if (lastExec) {
      lines.push("## Latest execution");
      lines.push("");
      if (typeof lastExec.status === "string") lines.push(`Status: ${lastExec.status}`);
      if (typeof lastExec.summary === "string") {
        lines.push("");
        lines.push(lastExec.summary);
      }
      lines.push("");
    }

    const lastQa = ticket.qaReports.length
      ? (ticket.qaReports[ticket.qaReports.length - 1].payload as any)
      : null;
    if (lastQa) {
      lines.push("## Latest QA");
      lines.push("");
      if (typeof lastQa.overall_status === "string") lines.push(`Overall: ${lastQa.overall_status}`);
      if (typeof lastQa.summary === "string") {
        lines.push("");
        lines.push(lastQa.summary);
      }
      lines.push("");
    }

    return `${lines.join("\n")}\n`;
  }

  function renderAskMarkdown(ask: AskRecord): string {
    const lines: string[] = [];
    lines.push(`# ${ask.askId}`);
    lines.push("");
    lines.push(`- Project: ${ask.projectId}`);
    lines.push(`- Updated: ${ask.updatedAt}`);
    lines.push("");
    lines.push("## Question");
    lines.push("");
    lines.push(ask.question);
    lines.push("");
    lines.push("## Answer");
    lines.push("");
    lines.push(ask.answer ?? "(unanswered)");
    lines.push("");
    if (ask.relatedTicketIds.length > 0) {
      lines.push("## Related tickets");
      lines.push("");
      for (const id of ask.relatedTicketIds) lines.push(`- ${id}`);
      lines.push("");
    }
    return `${lines.join("\n")}\n`;
  }

  function renderProjectIndex(project: ProjectRecord) {
    const contents = [
      `# ${project.name} (${project.projectId})`,
      "",
      "Context is stored under this folder:",
      "",
      `- Tickets: \`./${vaultDirName}/tickets/\``,
      `- Asks: \`./${vaultDirName}/asks/\``,
      "",
      "Entry points:",
      "",
      `- Tickets index: \`./${vaultDirName}/tickets/index.md\``,
      `- Asks index: \`./${vaultDirName}/asks/index.md\``,
      "",
      "Search tips:",
      "",
      `- Full-text search: ripgrep \`rg -n \"<query>\" ./${vaultDirName}\``,
      "",
    ].join("\n");
    writeFileAtomic(projectIndexPath(project), `${contents}\n`);
  }

  function refreshTicketsIndex(project: ProjectRecord) {
    const entries = listJsonFiles(ticketsDir(project))
      .filter((filePath) => path.basename(filePath).toLowerCase() !== "index.json")
      .map((filePath) => {
        try {
          return readJsonFile<TicketRecord>(filePath);
        } catch (error) {
          console.warn(`Failed to read ticket file: ${filePath}`, error);
          return undefined;
        }
      })
      .filter((value): value is TicketRecord => value != null)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    const index = entries.map((ticket) => ({
      ticketId: ticket.ticketId,
      status: ticket.status ?? "open",
      title: ticketDisplayTitle(ticket),
      updatedAt: ticket.updatedAt,
    }));
    writeJsonFile(ticketsIndexJsonPath(project), { tickets: index });

    const mdLines: string[] = [];
    mdLines.push(`# Tickets (${project.projectId})`);
    mdLines.push("");
    if (index.length === 0) {
      mdLines.push("(No tickets yet.)");
    } else {
      for (const t of index) {
        mdLines.push(`- [${t.ticketId}] (${t.status}) ${t.title}`);
      }
    }
    mdLines.push("");
    writeFileAtomic(ticketsIndexMdPath(project), `${mdLines.join("\n")}\n`);
  }

  function refreshAsksIndex(project: ProjectRecord) {
    const entries = listJsonFiles(asksDir(project))
      .filter((filePath) => path.basename(filePath).toLowerCase() !== "index.json")
      .map((filePath) => {
        try {
          return readJsonFile<AskRecord>(filePath);
        } catch (error) {
          console.warn(`Failed to read ask file: ${filePath}`, error);
          return undefined;
        }
      })
      .filter((value): value is AskRecord => value != null)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    const index = entries.map((ask) => ({
      askId: ask.askId,
      updatedAt: ask.updatedAt,
      question: ask.question,
      answered: ask.answer != null && ask.answer.trim().length > 0,
    }));
    writeJsonFile(asksIndexJsonPath(project), { asks: index });

    const mdLines: string[] = [];
    mdLines.push(`# Asks (${project.projectId})`);
    mdLines.push("");
    if (index.length === 0) {
      mdLines.push("(No asks yet.)");
    } else {
      for (const a of index) {
        const status = a.answered ? "answered" : "open";
        mdLines.push(`- [${a.askId}] (${status}) ${a.question}`);
      }
    }
    mdLines.push("");
    writeFileAtomic(asksIndexMdPath(project), `${mdLines.join("\n")}\n`);
  }

  function writeTicketAndViews(project: ProjectRecord, ticket: TicketRecord) {
    ensureProjectVault(project);
    writeJsonFile(ticketJsonPath(project, ticket.ticketId), ticket);
    const mdPath = path.join(ticketsDir(project), `${ticket.ticketId}.md`);
    writeFileAtomic(mdPath, renderTicketMarkdown(ticket));
    refreshTicketsIndex(project);
  }

  function writeAskAndViews(project: ProjectRecord, ask: AskRecord) {
    ensureProjectVault(project);
    writeJsonFile(askJsonPath(project, ask.askId), ask);
    const mdPath = path.join(asksDir(project), `${ask.askId}.md`);
    writeFileAtomic(mdPath, renderAskMarkdown(ask));
    refreshAsksIndex(project);
  }

  function listTicketsForProject(project: ProjectRecord): TicketRecord[] {
    ensureProjectVault(project);
    return listJsonFiles(ticketsDir(project))
      .filter((filePath) => path.basename(filePath).toLowerCase() !== "index.json")
      .map((filePath) => {
        try {
          return readJsonFile<TicketRecord>(filePath);
        } catch (error) {
          console.warn(`Failed to read ticket file: ${filePath}`, error);
          return undefined;
        }
      })
      .filter((value): value is TicketRecord => value != null)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  function findTicketAcrossProjects(ticketId: string): TicketRecord | undefined {
    const projects = listProjectsInternal();
    let found: TicketRecord | undefined;
    for (const project of projects) {
      const candidate = readJsonFile<TicketRecord>(ticketJsonPath(project, ticketId));
      if (!candidate) continue;
      if (found) {
        throw new Error(
          `Ticket id "${ticketId}" exists in multiple projects; use project-scoped endpoints`,
        );
      }
      found = candidate;
    }
    return found;
  }

  function listProjectsInternal(): ProjectRecord[] {
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
  }

  function upsertTicket(
    ticketId: string,
    options?: { projectId?: string },
  ): TicketRecord {
    ensureDefaultProject();

    if (options?.projectId) {
      const project = getProjectOrThrow(options.projectId);
      ensureProjectVault(project);
      const filePath = ticketJsonPath(project, ticketId);
      const existing = readJsonFile<TicketRecord>(filePath);
      if (existing) {
        existing.updatedAt = nowIso();
        writeTicketAndViews(project, existing);
        return existing;
      }

      const created: TicketRecord = {
        schemaVersion: 2,
        ticketId,
        projectId: project.projectId,
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
      writeTicketAndViews(project, created);
      return created;
    }

    const existing = findTicketAcrossProjects(ticketId);
    if (existing) return existing;

    const fallbackProject = getProjectOrThrow("default");
    const created: TicketRecord = {
      schemaVersion: 2,
      ticketId,
      projectId: fallbackProject.projectId,
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
    writeTicketAndViews(fallbackProject, created);
    return created;
  }

  function appendTicketFeedback(
    ticketId: string,
    kind: TicketFeedbackKind,
    note: string,
  ): TicketRecord {
    const ticket = findTicketAcrossProjects(ticketId);
    if (!ticket) {
      throw new Error(`Ticket not found: ${ticketId}`);
    }
    const project = getProjectOrThrow(ticket.projectId);
    ticket.feedback[kind].push(note);
    ticket.updatedAt = nowIso();
    writeTicketAndViews(project, ticket);
    return ticket;
  }

  migrateLegacyTicketsIfEnabled();

  return {
    listProjects() {
      return listProjectsInternal();
    },
    getProject(projectId: string) {
      ensureDefaultProject();
      return readJsonFile<ProjectRecord>(projectRegistryPath(projectId));
    },
    upsertProject(projectId: string, input: ProjectUpsertInput) {
      ensureDefaultProject();

      const filePath = projectRegistryPath(projectId);
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
        ensureProjectVault(existing);
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
      ensureProjectVault(created);
      return created;
    },

    createTicket(projectId: string) {
      const project = getProjectOrThrow(projectId);
      ensureProjectVault(project);
      const ticketId = nextId("ticket");
      const ticket: TicketRecord = {
        schemaVersion: 2,
        ticketId,
        projectId: project.projectId,
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
      writeTicketAndViews(project, ticket);
      return ticket;
    },
    upsertTicket,
    listTickets() {
      const projects = listProjectsInternal();
      const all: TicketRecord[] = [];
      for (const project of projects) {
        all.push(...listTicketsForProject(project));
      }
      return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    getTicket(ticketId: string) {
      return findTicketAcrossProjects(ticketId);
    },
    getTicketForProject(projectId: string, ticketId: string) {
      const project = getProjectOrThrow(projectId);
      ensureProjectVault(project);
      return readJsonFile<TicketRecord>(ticketJsonPath(project, ticketId));
    },
    appendTicketFeedback,

    recordRequirements(envelope: AgentOutputEnvelopeRequirements) {
      const ticket = findTicketAcrossProjects(envelope.ticket_id) ?? upsertTicket(envelope.ticket_id);
      const project = getProjectOrThrow(ticket.projectId);
      ticket.latestRequirements = envelope;
      ticket.updatedAt = nowIso();
      writeTicketAndViews(project, ticket);
      persistRun(envelope);
      return ticket;
    },
    recordPlan(envelope: AgentOutputEnvelopePlan) {
      const ticket = findTicketAcrossProjects(envelope.ticket_id) ?? upsertTicket(envelope.ticket_id);
      const project = getProjectOrThrow(ticket.projectId);
      ticket.latestPlan = envelope;
      ticket.planHistory.push(envelope);
      ticket.updatedAt = nowIso();
      writeTicketAndViews(project, ticket);
      persistRun(envelope);
      return ticket;
    },
    recordExecutionResult(envelope: AgentOutputEnvelopeExecutionResult) {
      const ticket = findTicketAcrossProjects(envelope.ticket_id) ?? upsertTicket(envelope.ticket_id);
      const project = getProjectOrThrow(ticket.projectId);
      ticket.executionResults.push(envelope);
      ticket.updatedAt = nowIso();
      writeTicketAndViews(project, ticket);
      persistRun(envelope);
      return ticket;
    },
    recordQaReport(envelope: AgentOutputEnvelopeQaReport) {
      const ticket = findTicketAcrossProjects(envelope.ticket_id) ?? upsertTicket(envelope.ticket_id);
      const project = getProjectOrThrow(ticket.projectId);
      ticket.qaReports.push(envelope);
      ticket.updatedAt = nowIso();
      writeTicketAndViews(project, ticket);
      persistRun(envelope);
      return ticket;
    },

    createAsk(projectId: string, question: string) {
      const project = getProjectOrThrow(projectId);
      ensureProjectVault(project);
      const askId = nextId("ask");
      const ask: AskRecord = {
        schemaVersion: 1,
        askId,
        projectId: project.projectId,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        question,
        answer: null,
        relatedTicketIds: [],
      };
      writeAskAndViews(project, ask);
      return ask;
    },
    listAsks(projectId: string) {
      const project = getProjectOrThrow(projectId);
      ensureProjectVault(project);
      return listJsonFiles(asksDir(project))
        .filter((filePath) => path.basename(filePath).toLowerCase() !== "index.json")
        .map((filePath) => {
          try {
            return readJsonFile<AskRecord>(filePath);
          } catch (error) {
            console.warn(`Failed to read ask file: ${filePath}`, error);
            return undefined;
          }
        })
        .filter((value): value is AskRecord => value != null)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    getAsk(projectId: string, askId: string) {
      const project = getProjectOrThrow(projectId);
      ensureProjectVault(project);
      return readJsonFile<AskRecord>(askJsonPath(project, askId));
    },
    answerAsk(projectId: string, askId: string, answer: string) {
      const project = getProjectOrThrow(projectId);
      ensureProjectVault(project);
      const ask = readJsonFile<AskRecord>(askJsonPath(project, askId));
      if (!ask) {
        throw new Error(`Ask not found: ${projectId}/${askId}`);
      }
      ask.answer = answer;
      ask.updatedAt = nowIso();
      writeAskAndViews(project, ask);
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
        .filter((value): value is AgentRunRecord => value != null)
        .sort((a, b) => b.storedAt.localeCompare(a.storedAt));
    },
    getRun(id: string) {
      return readJsonFile<AgentRunRecord>(runPath(id));
    },
  };
}
