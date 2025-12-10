import express, { type Request, type Response } from "express";
import cors from "cors";
import { config } from "./config.js";
import swaggerUi from "swagger-ui-express";
import { openApiSpec } from "./openapi.js";
import {
  getTicket,
  listTickets,
  recordPlan,
  recordRequirements,
  recordExecutionResult,
  recordQaReport,
  upsertTicket,
} from "./storage.js";
import { runPlannerForTicket } from "./plannerAgent.js";
import { runRequirementsForTicket } from "./requirementsAgent.js";
import { runImplementerForTicket } from "./implementerAgent.js";
import { runQaForTicket } from "./qaAgent.js";
import type {
  AgentOutputEnvelope,
  ExecutionResultPayload,
  PlanPayload,
  QaReportPayload,
  RequirementsPayload,
} from "./payloadTypes.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use(
  "/docs",
  swaggerUi.serve,
  swaggerUi.setup(openApiSpec, {
    customSiteTitle: "AutoWorker API Docs",
  }),
);

app.get("/openapi.json", (_req: Request, res: Response) => {
  res.json(openApiSpec);
});

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// Tickets are identified by ticket_id (e.g. T-123) and aggregate
// structured outputs from different agent roles.

app.get("/api/tickets", (_req: Request, res: Response) => {
  res.json({ tickets: listTickets() });
});

// For now this only ensures the ticket record exists; real systems would
// likely sync tickets from an external tracker.
app.post("/api/tickets/:ticketId", (req: Request, res: Response) => {
  const ticketId = req.params.ticketId;
  const ticket = upsertTicket(ticketId);
  res.status(201).json({ ticket });
});

app.get("/api/tickets/:ticketId", (req: Request, res: Response) => {
  const ticketId = req.params.ticketId;
  const ticket = getTicket(ticketId);
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }
  res.json({ ticket });
});

// === Requirements agent (Request Owner) ===

// Trigger a requirements run to structure a raw ticket description.
// Body: { raw_description: string, notes_for_agent?: string }
app.post(
  "/api/tickets/:ticketId/requirements",
  async (req: Request, res: Response) => {
    const ticketId = req.params.ticketId;
    const { raw_description, notes_for_agent } = req.body ?? {};

    if (!raw_description || typeof raw_description !== "string") {
      res
        .status(400)
        .json({ error: "raw_description (string) is required" });
      return;
    }

    const ticket = upsertTicket(ticketId);
    if (typeof notes_for_agent === "string" && notes_for_agent.trim()) {
      ticket.feedback.requirements.push(notes_for_agent.trim());
    }

    try {
      const envelope = await runRequirementsForTicket({
        ticketId,
        rawTicketDescription: raw_description,
        notesForAgent:
          typeof notes_for_agent === "string" ? notes_for_agent : undefined,
      });
      res.json({ requirements: envelope });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to generate requirements";
      res.status(500).json({ error: message });
    }
  },
);

// Manually record a requirements envelope (e.g. for replay).
app.post(
  "/api/tickets/:ticketId/requirements/envelope",
  (req: Request, res: Response) => {
    const ticketId = req.params.ticketId;
    const envelope = req.body as AgentOutputEnvelope<RequirementsPayload>;

    if (!envelope || envelope.ticket_id !== ticketId) {
      res.status(400).json({
        error: "Envelope.ticket_id must match ticketId in the URL",
      });
      return;
    }
    if (envelope.payload_type !== "requirements") {
      res.status(400).json({
        error: 'payload_type must be "requirements" for this endpoint',
      });
      return;
    }

    const ticket = recordRequirements(envelope);
    res.status(201).json({ ticket, requirements: envelope });
  },
);

app.get(
  "/api/tickets/:ticketId/requirements",
  (req: Request, res: Response) => {
    const ticketId = req.params.ticketId;
    const ticket = getTicket(ticketId);
    if (!ticket || !ticket.latestRequirements) {
      res.status(404).json({ error: "No requirements found for ticket" });
      return;
    }
    res.json({ requirements: ticket.latestRequirements });
  },
);

// === Planner agent (Tech Lead) ===

// Trigger a planning run for a ticket using the Planner (Tech Lead).
// Body: { notes_for_agent?: string }
app.post(
  "/api/tickets/:ticketId/plan",
  async (req: Request, res: Response) => {
    const ticketId = req.params.ticketId;
    const { notes_for_agent } = req.body ?? {};

    const ticket = getTicket(ticketId);
    if (!ticket || !ticket.latestRequirements) {
      res
        .status(400)
        .json({ error: "Ticket must have requirements before planning" });
      return;
    }

    if (typeof notes_for_agent === "string" && notes_for_agent.trim()) {
      ticket.feedback.plan.push(notes_for_agent.trim());
    }

    try {
      const envelope = await runPlannerForTicket({
        ticketId,
        requirements: ticket.latestRequirements,
        notesForAgent:
          typeof notes_for_agent === "string" ? notes_for_agent : undefined,
      });
      res.json({ plan: envelope });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to generate plan";
      res.status(500).json({ error: message });
    }
  },
);

// Manually record a plan envelope that was generated elsewhere (e.g. for replay).
app.post(
  "/api/tickets/:ticketId/plan/envelope",
  (req: Request, res: Response) => {
    const ticketId = req.params.ticketId;
    const envelope = req.body as AgentOutputEnvelope<PlanPayload>;

    if (!envelope || envelope.ticket_id !== ticketId) {
      res.status(400).json({
        error: "Envelope.ticket_id must match ticketId in the URL",
      });
      return;
    }
    if (envelope.payload_type !== "plan") {
      res
        .status(400)
        .json({ error: 'payload_type must be "plan" for this endpoint' });
      return;
    }

    const ticket = recordPlan(envelope);
    res.status(201).json({ ticket, plan: envelope });
  },
);

// Retrieve the latest stored plan (AgentOutputEnvelope<PlanPayload>) for a ticket.
app.get("/api/tickets/:ticketId/plan", (req: Request, res: Response) => {
  const ticketId = req.params.ticketId;
  const ticket = getTicket(ticketId);
  if (!ticket || !ticket.latestPlan) {
    res.status(404).json({ error: "No plan found for ticket" });
    return;
  }
  res.json({ plan: ticket.latestPlan });
});

// === Implementer agent (Software Engineer) ===

// Body: { plan_id?: string, step_ids?: string[], notes_for_agent?: string }
app.post(
  "/api/tickets/:ticketId/execution",
  async (req: Request, res: Response) => {
    const ticketId = req.params.ticketId;
    const { plan_id, step_ids, notes_for_agent } = req.body ?? {};

    const ticket = getTicket(ticketId);
    if (!ticket || !ticket.latestPlan) {
      res
        .status(400)
        .json({ error: "Ticket must have a plan before execution" });
      return;
    }

    const candidatePlans = ticket.planHistory.length
      ? ticket.planHistory
      : [ticket.latestPlan];

    if (typeof notes_for_agent === "string" && notes_for_agent.trim()) {
      ticket.feedback.execution.push(notes_for_agent.trim());
    }

    const effectivePlanId =
      typeof plan_id === "string"
        ? plan_id
        : (ticket.latestPlan.payload as PlanPayload).plan_id;

    const planEnvelope = candidatePlans.find(
      (p) => (p.payload as PlanPayload).plan_id === effectivePlanId,
    );

    if (!planEnvelope) {
      res.status(400).json({
        error: `No plan with plan_id="${effectivePlanId}" found for this ticket`,
      });
      return;
    }

    const stepIdsArray: string[] | undefined = Array.isArray(step_ids)
      ? step_ids.filter((s: unknown): s is string => typeof s === "string")
      : undefined;

    try {
      const envelope = await runImplementerForTicket({
        ticketId,
        plan: planEnvelope.payload as PlanPayload,
        stepIds: stepIdsArray,
        notesForAgent:
          typeof notes_for_agent === "string" ? notes_for_agent : undefined,
      });
      res.json({ execution: envelope });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to generate execution result";
      res.status(500).json({ error: message });
    }
  },
);

// Manually record an execution_result envelope.
app.post(
  "/api/tickets/:ticketId/execution/envelope",
  (req: Request, res: Response) => {
    const ticketId = req.params.ticketId;
    const envelope = req.body as AgentOutputEnvelope<ExecutionResultPayload>;

    if (!envelope || envelope.ticket_id !== ticketId) {
      res.status(400).json({
        error: "Envelope.ticket_id must match ticketId in the URL",
      });
      return;
    }
    if (envelope.payload_type !== "execution_result") {
      res.status(400).json({
        error: 'payload_type must be "execution_result" for this endpoint',
      });
      return;
    }

    const ticket = recordExecutionResult(envelope);
    res.status(201).json({ ticket, execution: envelope });
  },
);

app.get(
  "/api/tickets/:ticketId/execution",
  (req: Request, res: Response) => {
    const ticketId = req.params.ticketId;
    const ticket = getTicket(ticketId);
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    res.json({ executions: ticket.executionResults });
  },
);

// === QA agent ===

// Body: { plan_id?: string, notes_for_agent?: string }
app.post("/api/tickets/:ticketId/qa", async (req: Request, res: Response) => {
  const ticketId = req.params.ticketId;
  const { plan_id, notes_for_agent } = req.body ?? {};

  const ticket = getTicket(ticketId);
  if (!ticket || !ticket.latestPlan) {
    res
      .status(400)
      .json({ error: "Ticket must have a plan before QA can run" });
    return;
  }

  const candidatePlans = ticket.planHistory.length
    ? ticket.planHistory
    : [ticket.latestPlan];

  if (typeof notes_for_agent === "string" && notes_for_agent.trim()) {
    ticket.feedback.qa.push(notes_for_agent.trim());
  }

  const effectivePlanId =
    typeof plan_id === "string"
      ? plan_id
      : (ticket.latestPlan.payload as PlanPayload).plan_id;

  const planEnvelope = candidatePlans.find(
    (p) => (p.payload as PlanPayload).plan_id === effectivePlanId,
  );

  if (!planEnvelope) {
    res.status(400).json({
      error: `No plan with plan_id="${effectivePlanId}" found for this ticket`,
    });
    return;
  }

  try {
    const envelope = await runQaForTicket({
      ticketId,
      plan: planEnvelope.payload as PlanPayload,
      executionResults: ticket.executionResults,
      notesForAgent:
        typeof notes_for_agent === "string" ? notes_for_agent : undefined,
    });
    res.json({ qa_report: envelope });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate QA report";
    res.status(500).json({ error: message });
  }
});

// Manually record a QA report envelope.
app.post(
  "/api/tickets/:ticketId/qa/envelope",
  (req: Request, res: Response) => {
    const ticketId = req.params.ticketId;
    const envelope = req.body as AgentOutputEnvelope<QaReportPayload>;

    if (!envelope || envelope.ticket_id !== ticketId) {
      res.status(400).json({
        error: "Envelope.ticket_id must match ticketId in the URL",
      });
      return;
    }
    if (envelope.payload_type !== "qa_report") {
      res
        .status(400)
        .json({ error: 'payload_type must be "qa_report" for this endpoint' });
      return;
    }

    const ticket = recordQaReport(envelope);
    res.status(201).json({ ticket, qa_report: envelope });
  },
);

app.get("/api/tickets/:ticketId/qa", (req: Request, res: Response) => {
  const ticketId = req.params.ticketId;
  const ticket = getTicket(ticketId);
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }
  res.json({ qa_reports: ticket.qaReports });
});

app.listen(config.port, () => {
  console.log(`AutoWorker API listening on port ${config.port}`);
});
