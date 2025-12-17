# AutoWorker Context Vault Redesign (Multi-Project, Agent Read-Only)

This note captures the outcome of a redesign discussion and the code changes applied afterwards, so future maintainers (and LLMs) can quickly reconstruct intent, constraints, and how the system is supposed to work.

## Problem Statement

We wanted AutoWorker to support **multiple projects at once** and to act primarily as a **context handling system**:

- Each project has its own isolated history of conversation/decisions/work.
- The context is **file-based and searchable** (agents can `rg`/browse files to find what they need).
- Storage should be **configurable** (file-based initially; future backends should be possible).
- There are two interaction modes:
  - **Ask**: quick, rapid, precise questions/notes.
  - **Ticket**: planned, structured development/fix work.

## Hard Constraints (Key Decisions)

1. **Context is co-located** in the project’s working directory (most-used layout).
2. Agents must be **read-only** with respect to files:
   - Agents may read/grep context files to understand project state.
   - Agents must not edit context files (avoid accidental corruption).
   - The system validates agent structured output and persists updates.
3. IDs must be **system-generated**, human-friendly:
   - Tickets: `T-YYYY-####`
   - Asks: `A-YYYY-####`
4. Tickets are stored in **canonical JSON**, and the system can generate a **Markdown view** for agents to read/search.
5. Ask interactions are stored separately from tickets (“A” layout), not as a ticket subtype.
6. Tickets “always have a requirement” (no separate “intake” object required in ticket JSON).

## High-Level Architecture

### Project Registry (central)

AutoWorker maintains a registry of projects (project id + working directory). This lets the server manage many projects while writing context **into each project’s directory**.

- Registry storage location (current): `docs_ticket/projects/*.json`
- Each project has:
  - `projectId`
  - `name`
  - `workingDirectory` (the root directory agents work in)

### Per-project Context Vault (co-located)

For each project working directory, AutoWorker writes a `.autoworker/` folder that contains:

- Canonical JSON records (machine-friendly)
- Generated Markdown views (agent-friendly)

This vault is designed so an agent can reliably do:

- Open `.autoworker/INDEX.md`
- Browse `.autoworker/tickets/*.md` and `.autoworker/asks/*.md`
- Full-text search `.autoworker/` with ripgrep

## On-Disk Layout (per project working directory)

Root: `./.autoworker/`

### Tickets

- Canonical: `./.autoworker/tickets/T-YYYY-####.json`
- View: `./.autoworker/tickets/T-YYYY-####.md`
- Index:
  - `./.autoworker/tickets/index.json`
  - `./.autoworker/tickets/index.md`

### Asks

- Canonical: `./.autoworker/asks/A-YYYY-####.json`
- View: `./.autoworker/asks/A-YYYY-####.md`
- Index:
  - `./.autoworker/asks/index.json`
  - `./.autoworker/asks/index.md`

### Entrypoint

- `./.autoworker/INDEX.md` links to tickets/asks indexes and gives search hints.

### Vault metadata (lightweight)

- `./.autoworker/project.json` (minimal metadata)

## Ticket JSON Shape (canonical)

Ticket JSON stays aligned with the existing 4-agent pipeline output storage, plus minimal system fields:

- Added:
  - `schemaVersion` (optional; currently used as `2` for new tickets)
  - `status` (optional; enum: `open | in_progress | blocked | done | archived`)
- Existing fields (already present in the repo):
  - `latestRequirements` (required to meaningfully operate on the ticket)
  - `latestPlan`, `planHistory`
  - `executionResults`
  - `qaReports`
  - `feedback`

Rationale:
- We avoid storing redundant fields like `title` and `tags`; these can be derived from requirements payload when rendering indexes/views.
- We avoid a separate `intake` section since tickets are assumed to always have requirements.

## Ask JSON Shape (canonical)

Ask records are intentionally small and system-owned:

- `schemaVersion` (currently `1`)
- `askId` (`A-YYYY-####`)
- `projectId`
- `createdAt`, `updatedAt`
- `question` (string)
- `answer` (nullable string; unanswered if null)
- `relatedTicketIds` (string[])

## Agent Contract (Read-Only)

Agents are allowed to read/search the context vault but must not write.

### Enforced behavior

All agents are configured with Codex SDK sandbox mode set to `"read-only"`:

- Requirements agent: `src/agents/requirementsAgent.ts`
- Planner agent: `src/agents/plannerAgent.ts`
- Implementer agent: `src/agents/implementerAgent.ts`
- QA agent: `src/agents/qaAgent.ts`

### Prompt hint

Each agent prompt includes a reminder:

> “Project context lives in the working directory under ./.autoworker/; you may search/read it as needed.”

## APIs Added/Adjusted

### Tickets

- **Create ticket with system-generated ID**:
  - `POST /api/projects/:projectId/tickets`
  - Returns `{ ticket }`
- **Project-scoped ticket read** (avoid cross-project ambiguity):
  - `GET /api/projects/:projectId/tickets/:ticketId`

Notes:
- The legacy “upsert a ticket by explicit id” endpoint still exists (`POST /api/tickets/:ticketId`), but the intended UX is to create tickets via the project-scoped endpoint so the system controls IDs.

### Asks

- `GET /api/projects/:projectId/asks` → `{ asks }`
- `POST /api/projects/:projectId/asks` with `{ question }` → `{ ask }`
- `GET /api/projects/:projectId/asks/:askId` → `{ ask }`
- `POST /api/projects/:projectId/asks/:askId/answer` with `{ answer }` → `{ ask }`

## UI Changes

- Ticket creation no longer asks for a manual ticket id; it calls the system-generated ticket creation endpoint.
- Project Q&A is now persisted as “Asks” via API instead of local-only state.

Key files:
- `ui/src/views/TicketDashboard.tsx`
- `ui/src/state/tickets.ts`
- `ui/src/state/asks.ts`

## Storage Backend Behavior

Storage backend selection uses `TICKET_STORAGE`:

- Default changed to `"vault"` (co-located `.autoworker/`).
- `"file"` and `"memory"` backends still exist.

Vault backend:
- Implemented in `src/persistence/vaultAdapter.ts`
- Writes `.autoworker/` under each project’s `workingDirectory`.
- Generates indexes and Markdown views whenever tickets/asks are created or updated.

## ID Generation

Ticket and Ask IDs are system-generated, human-friendly:

- Tickets: `T-YYYY-####`
- Asks: `A-YYYY-####`

Sequence state is stored in a single file:

- `docs_ticket/seq.json` (global sequence across projects, by design)

Rationale:
- Ensures uniqueness across projects without requiring per-project sequence files.

## Legacy Data Migration (Optional)

Vault adapter can migrate legacy tickets stored in:

- `docs_ticket/tickets/*.json`

Behavior:
- Disabled by default.
- Enable once via env var:
  - `AUTO_WORKER_MIGRATE_LEGACY=true`
- On startup, legacy tickets are copied into the owning project’s `.autoworker/tickets/` if they do not already exist there.

## Where to Look in Code

Core changes:

- Vault storage + rendering: `src/persistence/vaultAdapter.ts`
- Domain schema additions: `src/models/domainSchemas.ts`
- Storage facade + default backend: `src/storage.ts`
- New APIs: `src/http/routes.ts`
- Agent read-only enforcement: `src/agents/*.ts`
- UI integration:
  - `ui/src/state/asks.ts`
  - `ui/src/state/tickets.ts`
  - `ui/src/views/TicketDashboard.tsx`

## Current Behavior Summary

- Multi-project is supported via the project registry; each project writes context under its `workingDirectory/.autoworker/`.
- Agents can self-serve context by searching `.autoworker/` but are technically prevented from writing via sandbox mode.
- Ticket creation is system-generated and project-scoped.
- Asks are persisted and indexed per project, with canonical JSON and a Markdown view.

## Suggested Next Steps (Not Implemented Here)

- Add endpoints/UI for ticket status transitions (`open/in_progress/blocked/done/archived`).
- Add re-render commands (rebuild indexes/MD from JSON) to recover from partial writes.
- Add locking for concurrent writes into the same `.autoworker/` vault (important if multiple server processes or concurrent actions target one project).
- Consider switching global sequence to per-project sequence if you ever need project-local numbering.

