import type { Express, Request, Response } from "express";
import { config } from "../config.js";
import {
  appendTicketFeedback,
  answerAsk,
  createAsk,
  createTicket,
  getAsk,
  getTicket,
  getTicketForProject,
  getProject,
  listAsks,
  listTickets,
  listProjects,
  recordExecutionResult,
  recordPlan,
  recordQaReport,
  recordRequirements,
  upsertProject,
  upsertTicket,
} from "../storage.js";
import { runPlannerForTicket } from "../agents/plannerAgent.js";
import { runRequirementsForTicket } from "../agents/requirementsAgent.js";
import { runImplementerForTicket } from "../agents/implementerAgent.js";
import { runQaForTicket } from "../agents/qaAgent.js";
import type {
  AgentOutputEnvelopeExecutionResult,
  AgentOutputEnvelopePlan,
  AgentOutputEnvelopeQaReport,
  AgentOutputEnvelopeRequirements,
  PlanPayload,
} from "../models/domainTypes.js";
import {
  registry,
  z,
  AskRecordSchema,
  ProjectRecordSchema,
  TicketRecordSchema,
  AgentOutputEnvelopeRequirementsSchema,
  AgentOutputEnvelopePlanSchema,
  AgentOutputEnvelopeExecutionResultSchema,
  AgentOutputEnvelopeQaReportSchema,
  ErrorResponseSchema,
  PlanPayloadSchema,
} from "./openapiRegistry.js";

const RequirementsBodySchema = z.object({
  raw_description: z.string().optional(),
  notes_for_agent: z.string().optional(),
});

const PlanBodySchema = z.object({
  notes_for_agent: z.string().optional(),
});

const ExecutionBodySchema = z.object({
  plan_id: z.string().optional(),
  step_ids: z.array(z.string()).optional(),
  notes_for_agent: z.string().optional(),
});

const QaBodySchema = z.object({
  plan_id: z.string().optional(),
  notes_for_agent: z.string().optional(),
});

const ProjectUpsertBodySchema = z.object({
  name: z.string().optional(),
  workingDirectory: z.string().optional(),
});

const TicketUpsertBodySchema = z.object({
  projectId: z.string().optional(),
  projectName: z.string().optional(),
  workingDirectory: z.string().optional(),
});

const AskCreateBodySchema = z.object({
  question: z.string(),
});

const AskAnswerBodySchema = z.object({
  answer: z.string(),
});

export function registerRoutes(app: Express) {
  // Health
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  registry.registerPath({
    method: "get",
    path: "/health",
    tags: ["System"],
    summary: "Health check",
    responses: {
      200: {
        description: "Service is healthy",
        content: {
          "application/json": {
            schema: z.object({
              status: z.string().openapi({ example: "ok" }),
            }),
          },
        },
      },
    },
  });

  // Projects listing
  app.get("/api/projects", (_req: Request, res: Response) => {
    res.json({ projects: listProjects() });
  });

  registry.registerPath({
    method: "get",
    path: "/api/projects",
    tags: ["Projects"],
    summary: "List projects",
    responses: {
      200: {
        description: "List of projects",
        content: {
          "application/json": {
            schema: z.object({
              projects: z.array(ProjectRecordSchema),
            }),
          },
        },
      },
    },
  });

  // Get project
  app.get("/api/projects/:projectId", (req: Request, res: Response) => {
    const projectId = req.params.projectId;
    const project = getProject(projectId);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.json({ project });
  });

  registry.registerPath({
    method: "get",
    path: "/api/projects/{projectId}",
    tags: ["Projects"],
    summary: "Get project by ID",
    request: {
      params: z.object({
        projectId: z.string(),
      }),
    },
    responses: {
      200: {
        description: "Project details",
        content: {
          "application/json": {
            schema: z.object({
              project: ProjectRecordSchema,
            }),
          },
        },
      },
      404: {
        description: "Project not found",
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
      },
    },
  });

  // Create or update project
  app.post("/api/projects/:projectId", (req: Request, res: Response) => {
    const projectId = req.params.projectId;
    const parseResult = ProjectUpsertBodySchema.safeParse(req.body ?? {});
    if (!parseResult.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const project = upsertProject(projectId, {
      name: parseResult.data.name,
      workingDirectory: parseResult.data.workingDirectory,
    });
    res.status(201).json({ project });
  });

  registry.registerPath({
    method: "post",
    path: "/api/projects/{projectId}",
    tags: ["Projects"],
    summary: "Create or update a project",
    request: {
      params: z.object({
        projectId: z.string(),
      }),
      body: {
        content: {
          "application/json": {
            schema: ProjectUpsertBodySchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: "Project created or updated",
        content: {
          "application/json": {
            schema: z.object({
              project: ProjectRecordSchema,
            }),
          },
        },
      },
      400: {
        description: "Invalid request body",
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
      },
    },
  });

  // Create ticket (system-generated id) in project
  app.post("/api/projects/:projectId/tickets", (req: Request, res: Response) => {
    const projectId = req.params.projectId;
    try {
      const ticket = createTicket(projectId);
      res.status(201).json({ ticket });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create ticket";
      res.status(400).json({ error: message });
    }
  });

  registry.registerPath({
    method: "post",
    path: "/api/projects/{projectId}/tickets",
    tags: ["Tickets"],
    summary: "Create a ticket with a system-generated ID inside a project",
    request: {
      params: z.object({
        projectId: z.string(),
      }),
    },
    responses: {
      201: {
        description: "Ticket created",
        content: {
          "application/json": {
            schema: z.object({
              ticket: TicketRecordSchema,
            }),
          },
        },
      },
      400: {
        description: "Invalid request",
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
      },
    },
  });

  // Project-scoped ticket read (avoids cross-project id ambiguity)
  app.get(
    "/api/projects/:projectId/tickets/:ticketId",
    (req: Request, res: Response) => {
      const { projectId, ticketId } = req.params;
      try {
        const ticket = getTicketForProject(projectId, ticketId);
        if (!ticket) {
          res.status(404).json({ error: "Ticket not found" });
          return;
        }
        res.json({ ticket });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load ticket";
        res.status(400).json({ error: message });
      }
    },
  );

  registry.registerPath({
    method: "get",
    path: "/api/projects/{projectId}/tickets/{ticketId}",
    tags: ["Tickets"],
    summary: "Get a ticket by ID within a project",
    request: {
      params: z.object({
        projectId: z.string(),
        ticketId: z.string(),
      }),
    },
    responses: {
      200: {
        description: "Ticket details",
        content: {
          "application/json": {
            schema: z.object({
              ticket: TicketRecordSchema,
            }),
          },
        },
      },
      404: {
        description: "Ticket not found",
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
      },
    },
  });

  // Project asks
  app.get("/api/projects/:projectId/asks", (req: Request, res: Response) => {
    const projectId = req.params.projectId;
    try {
      res.json({ asks: listAsks(projectId) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to list asks";
      res.status(400).json({ error: message });
    }
  });

  registry.registerPath({
    method: "get",
    path: "/api/projects/{projectId}/asks",
    tags: ["Asks"],
    summary: "List asks for a project",
    request: {
      params: z.object({ projectId: z.string() }),
    },
    responses: {
      200: {
        description: "Asks list",
        content: {
          "application/json": {
            schema: z.object({
              asks: z.array(AskRecordSchema),
            }),
          },
        },
      },
    },
  });

  app.post("/api/projects/:projectId/asks", (req: Request, res: Response) => {
    const projectId = req.params.projectId;
    const parseResult = AskCreateBodySchema.safeParse(req.body ?? {});
    if (!parseResult.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    try {
      const ask = createAsk(projectId, parseResult.data.question);
      res.status(201).json({ ask });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create ask";
      res.status(400).json({ error: message });
    }
  });

  registry.registerPath({
    method: "post",
    path: "/api/projects/{projectId}/asks",
    tags: ["Asks"],
    summary: "Create an ask (question/note) for a project",
    request: {
      params: z.object({ projectId: z.string() }),
      body: {
        content: {
          "application/json": {
            schema: AskCreateBodySchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: "Ask created",
        content: {
          "application/json": {
            schema: z.object({
              ask: AskRecordSchema,
            }),
          },
        },
      },
      400: {
        description: "Invalid request body",
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
      },
    },
  });

  app.get("/api/projects/:projectId/asks/:askId", (req: Request, res: Response) => {
    const { projectId, askId } = req.params;
    try {
      const ask = getAsk(projectId, askId);
      if (!ask) {
        res.status(404).json({ error: "Ask not found" });
        return;
      }
      res.json({ ask });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load ask";
      res.status(400).json({ error: message });
    }
  });

  registry.registerPath({
    method: "get",
    path: "/api/projects/{projectId}/asks/{askId}",
    tags: ["Asks"],
    summary: "Get an ask by ID within a project",
    request: {
      params: z.object({ projectId: z.string(), askId: z.string() }),
    },
    responses: {
      200: {
        description: "Ask details",
        content: {
          "application/json": {
            schema: z.object({
              ask: AskRecordSchema,
            }),
          },
        },
      },
      404: {
        description: "Ask not found",
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
      },
    },
  });

  app.post(
    "/api/projects/:projectId/asks/:askId/answer",
    (req: Request, res: Response) => {
      const { projectId, askId } = req.params;
      const parseResult = AskAnswerBodySchema.safeParse(req.body ?? {});
      if (!parseResult.success) {
        res.status(400).json({ error: "Invalid request body" });
        return;
      }

      try {
        const ask = answerAsk(projectId, askId, parseResult.data.answer);
        res.status(201).json({ ask });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to answer ask";
        res.status(400).json({ error: message });
      }
    },
  );

  registry.registerPath({
    method: "post",
    path: "/api/projects/{projectId}/asks/{askId}/answer",
    tags: ["Asks"],
    summary: "Store an answer for an ask",
    request: {
      params: z.object({ projectId: z.string(), askId: z.string() }),
      body: {
        content: {
          "application/json": {
            schema: AskAnswerBodySchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: "Ask updated",
        content: {
          "application/json": {
            schema: z.object({
              ask: AskRecordSchema,
            }),
          },
        },
      },
    },
  });

  // Tickets listing
  app.get("/api/tickets", (_req: Request, res: Response) => {
    res.json({ tickets: listTickets() });
  });

  registry.registerPath({
    method: "get",
    path: "/api/tickets",
    tags: ["Tickets"],
    summary: "List tickets",
    responses: {
      200: {
        description: "List of tickets",
        content: {
          "application/json": {
            schema: z.object({
              tickets: z.array(TicketRecordSchema),
            }),
          },
        },
      },
    },
  });

  // Ensure ticket exists
  app.post("/api/tickets/:ticketId", (req: Request, res: Response) => {
    const ticketId = req.params.ticketId;
    const parseResult = TicketUpsertBodySchema.safeParse(req.body ?? {});
    if (!parseResult.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const projectId = parseResult.data.projectId ?? ticketId;
    upsertProject(projectId, {
      name: parseResult.data.projectName ?? projectId,
      workingDirectory:
        parseResult.data.workingDirectory ??
        config.codex.workingDirectory ??
        process.cwd(),
    });

    const ticket = upsertTicket(ticketId, { projectId });
    res.status(201).json({ ticket });
  });

  registry.registerPath({
    method: "post",
    path: "/api/tickets/{ticketId}",
    tags: ["Tickets"],
    summary: "Create or update a ticket shell",
    request: {
      params: z.object({
        ticketId: z.string(),
      }),
      body: {
        content: {
          "application/json": {
            schema: TicketUpsertBodySchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: "Ticket created or updated",
        content: {
          "application/json": {
            schema: z.object({
              ticket: TicketRecordSchema,
            }),
          },
        },
      },
    },
  });

  // Get ticket
  app.get("/api/tickets/:ticketId", (req: Request, res: Response) => {
    const ticketId = req.params.ticketId;
    const ticket = getTicket(ticketId);
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    res.json({ ticket });
  });

  registry.registerPath({
    method: "get",
    path: "/api/tickets/{ticketId}",
    tags: ["Tickets"],
    summary: "Get ticket by ID",
    request: {
      params: z.object({
        ticketId: z.string(),
      }),
    },
    responses: {
      200: {
        description: "Ticket details",
        content: {
          "application/json": {
            schema: z.object({
              ticket: TicketRecordSchema,
            }),
          },
        },
      },
      404: {
        description: "Ticket not found",
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
      },
    },
  });

  // Requirements agent
  app.post(
    "/api/tickets/:ticketId/requirements",
    async (req: Request, res: Response) => {
      const ticketId = req.params.ticketId;
      const parseResult = RequirementsBodySchema.safeParse(req.body ?? {});
      if (!parseResult.success) {
        res.status(400).json({ error: "Invalid request body" });
        return;
      }

      const { raw_description, notes_for_agent } = parseResult.data;

      const ticketBeforeFeedback = upsertTicket(ticketId);
      const project =
        getProject(ticketBeforeFeedback.projectId) ??
        upsertProject(ticketBeforeFeedback.projectId, {
          name: ticketBeforeFeedback.projectId,
          workingDirectory: config.codex.workingDirectory ?? process.cwd(),
        });

      const ticket =
        notes_for_agent && notes_for_agent.trim()
          ? appendTicketFeedback(ticketId, "requirements", notes_for_agent.trim())
          : ticketBeforeFeedback;

      const effectiveRawDescription =
        raw_description && raw_description.trim().length > 0
          ? raw_description
          : ticket.latestRequirements?.payload.source.raw_description;

      if (!effectiveRawDescription || effectiveRawDescription.trim().length === 0) {
        res.status(400).json({
          error:
            "raw_description is required for the first requirements run (or provide it again to override)",
        });
        return;
      }

      try {
        const envelope = await runRequirementsForTicket({
          ticketId,
          rawTicketDescription: effectiveRawDescription,
          previousRequirements: ticket.latestRequirements,
          requirementsFeedbackHistory: ticket.feedback.requirements,
          workingDirectory: project.workingDirectory,
        });
        res.json({ ticket: getTicket(ticketId) ?? ticket, requirements: envelope });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to generate requirements";
        res.status(500).json({ error: message });
      }
    },
  );

  registry.registerPath({
    method: "post",
    path: "/api/tickets/{ticketId}/requirements",
    tags: ["Requirements"],
    summary:
      "Run requirements agent for a ticket (uses prior requirements + stored feedback when present)",
    request: {
      params: z.object({ ticketId: z.string() }),
      body: {
        content: {
          "application/json": {
            schema: RequirementsBodySchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Requirements envelope for the ticket",
        content: {
          "application/json": {
            schema: z.object({
              ticket: TicketRecordSchema,
              requirements: AgentOutputEnvelopeRequirementsSchema,
            }),
          },
        },
      },
      400: {
        description: "Invalid request",
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
      },
      500: {
        description: "Failed to generate requirements",
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
      },
    },
  });

  app.post(
    "/api/tickets/:ticketId/requirements/envelope",
    (req: Request, res: Response) => {
      const ticketId = req.params.ticketId;
      const envelope = req.body as AgentOutputEnvelopeRequirements;

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

  registry.registerPath({
    method: "post",
    path: "/api/tickets/{ticketId}/requirements/envelope",
    tags: ["Requirements"],
    summary: "Store a requirements envelope",
    request: {
      params: z.object({ ticketId: z.string() }),
      body: {
        content: {
          "application/json": {
            schema: AgentOutputEnvelopeRequirementsSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: "Requirements envelope stored",
        content: {
          "application/json": {
            schema: z.object({
              ticket: TicketRecordSchema,
              requirements: AgentOutputEnvelopeRequirementsSchema,
            }),
          },
        },
      },
      400: {
        description: "Invalid envelope",
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
      },
    },
  });

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

  registry.registerPath({
    method: "get",
    path: "/api/tickets/{ticketId}/requirements",
    tags: ["Requirements"],
    summary: "Get latest requirements for a ticket",
    request: {
      params: z.object({ ticketId: z.string() }),
    },
    responses: {
      200: {
        description: "Latest requirements envelope for the ticket",
        content: {
          "application/json": {
            schema: z.object({
              requirements: AgentOutputEnvelopeRequirementsSchema,
            }),
          },
        },
      },
      404: {
        description: "No requirements found for ticket",
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
      },
    },
  });

  // Planner
  app.post(
    "/api/tickets/:ticketId/plan",
    async (req: Request, res: Response) => {
      const ticketId = req.params.ticketId;
      const parseResult = PlanBodySchema.safeParse(req.body ?? {});
      if (!parseResult.success) {
        res.status(400).json({ error: "Invalid request body" });
        return;
      }

      const { notes_for_agent } = parseResult.data;

      const ticket = getTicket(ticketId);
      if (!ticket || !ticket.latestRequirements) {
        res
          .status(400)
          .json({ error: "Ticket must have requirements before planning" });
        return;
      }

      if (notes_for_agent && notes_for_agent.trim()) {
        appendTicketFeedback(ticketId, "plan", notes_for_agent.trim());
      }

      try {
        const project =
          getProject(ticket.projectId) ??
          upsertProject(ticket.projectId, {
            name: ticket.projectId,
            workingDirectory: config.codex.workingDirectory ?? process.cwd(),
          });
        const envelope = await runPlannerForTicket({
          ticketId,
          requirements: ticket.latestRequirements,
          notesForAgent: notes_for_agent ?? undefined,
          workingDirectory: project.workingDirectory,
        });
        res.json({ plan: envelope });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to generate plan";
        res.status(500).json({ error: message });
      }
    },
  );

  registry.registerPath({
    method: "post",
    path: "/api/tickets/{ticketId}/plan",
    tags: ["Planning"],
    summary: "Run planner agent for a ticket",
    request: {
      params: z.object({ ticketId: z.string() }),
      body: {
        content: {
          "application/json": {
            schema: PlanBodySchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Plan envelope for the ticket",
        content: {
          "application/json": {
            schema: z.object({
              plan: AgentOutputEnvelopePlanSchema,
            }),
          },
        },
      },
      400: {
        description:
          "Ticket not ready for planning or invalid request body",
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
      },
      500: {
        description: "Failed to generate plan",
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
      },
    },
  });

  app.post(
    "/api/tickets/:ticketId/plan/envelope",
    (req: Request, res: Response) => {
      const ticketId = req.params.ticketId;
      const envelope = req.body as AgentOutputEnvelopePlan;

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

  registry.registerPath({
    method: "post",
    path: "/api/tickets/{ticketId}/plan/envelope",
    tags: ["Planning"],
    summary: "Store a plan envelope",
    request: {
      params: z.object({ ticketId: z.string() }),
      body: {
        content: {
          "application/json": {
            schema: AgentOutputEnvelopePlanSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: "Plan envelope stored",
        content: {
          "application/json": {
            schema: z.object({
              ticket: TicketRecordSchema,
              plan: AgentOutputEnvelopePlanSchema,
            }),
          },
        },
      },
      400: {
        description: "Invalid envelope",
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
      },
    },
  });

  app.get("/api/tickets/:ticketId/plan", (req: Request, res: Response) => {
    const ticketId = req.params.ticketId;
    const ticket = getTicket(ticketId);
    if (!ticket || !ticket.latestPlan) {
      res.status(404).json({ error: "No plan found for ticket" });
      return;
    }
    res.json({ plan: ticket.latestPlan });
  });

  registry.registerPath({
    method: "get",
    path: "/api/tickets/{ticketId}/plan",
    tags: ["Planning"],
    summary: "Get latest plan for a ticket",
    request: {
      params: z.object({ ticketId: z.string() }),
    },
    responses: {
      200: {
        description: "Latest plan envelope for the ticket",
        content: {
          "application/json": {
            schema: z.object({
              plan: AgentOutputEnvelopePlanSchema,
            }),
          },
        },
      },
      404: {
        description: "No plan found for ticket",
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
      },
    },
  });

  // Implementer
  app.post(
    "/api/tickets/:ticketId/execution",
    async (req: Request, res: Response) => {
      const ticketId = req.params.ticketId;
      const parseResult = ExecutionBodySchema.safeParse(req.body ?? {});
      if (!parseResult.success) {
        res.status(400).json({ error: "Invalid request body" });
        return;
      }

      const { plan_id, step_ids, notes_for_agent } = parseResult.data;

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

      const stepIdsArray: string[] | undefined = step_ids;

      try {
        const project =
          getProject(ticket.projectId) ??
          upsertProject(ticket.projectId, {
            name: ticket.projectId,
            workingDirectory: config.codex.workingDirectory ?? process.cwd(),
          });
        const envelope = await runImplementerForTicket({
          ticketId,
          plan: planEnvelope.payload as PlanPayload,
          stepIds: stepIdsArray,
          notesForAgent: notes_for_agent ?? undefined,
          workingDirectory: project.workingDirectory,
        });
        res.json({ execution: envelope });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to generate execution result";
        res.status(500).json({ error: message });
      }
    },
  );

  registry.registerPath({
    method: "post",
    path: "/api/tickets/{ticketId}/execution",
    tags: ["Execution"],
    summary: "Run implementer agent for a ticket",
    request: {
      params: z.object({ ticketId: z.string() }),
      body: {
        content: {
          "application/json": {
            schema: ExecutionBodySchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Execution result envelope for the ticket",
        content: {
          "application/json": {
            schema: z.object({
              execution: AgentOutputEnvelopeExecutionResultSchema,
            }),
          },
        },
      },
      400: {
        description:
          "Ticket not ready for execution or invalid request body",
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
      },
      500: {
        description: "Failed to generate execution result",
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
      },
    },
  });

  app.post(
    "/api/tickets/:ticketId/execution/envelope",
    (req: Request, res: Response) => {
      const ticketId = req.params.ticketId;
      const envelope = req.body as AgentOutputEnvelopeExecutionResult;

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

  registry.registerPath({
    method: "post",
    path: "/api/tickets/{ticketId}/execution/envelope",
    tags: ["Execution"],
    summary: "Store an execution_result envelope",
    request: {
      params: z.object({ ticketId: z.string() }),
      body: {
        content: {
          "application/json": {
            schema: AgentOutputEnvelopeExecutionResultSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: "Execution result envelope stored",
        content: {
          "application/json": {
            schema: z.object({
              ticket: TicketRecordSchema,
              execution: AgentOutputEnvelopeExecutionResultSchema,
            }),
          },
        },
      },
      400: {
        description: "Invalid envelope",
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
      },
    },
  });

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

  registry.registerPath({
    method: "get",
    path: "/api/tickets/{ticketId}/execution",
    tags: ["Execution"],
    summary: "List execution results for a ticket",
    request: {
      params: z.object({ ticketId: z.string() }),
    },
    responses: {
      200: {
        description: "Execution result envelopes for the ticket",
        content: {
          "application/json": {
            schema: z.object({
              executions: z.array(AgentOutputEnvelopeExecutionResultSchema),
            }),
          },
        },
      },
      404: {
        description: "Ticket not found",
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
      },
    },
  });

  // QA
  app.post(
    "/api/tickets/:ticketId/qa",
    async (req: Request, res: Response) => {
      const ticketId = req.params.ticketId;
      const parseResult = QaBodySchema.safeParse(req.body ?? {});
      if (!parseResult.success) {
        res.status(400).json({ error: "Invalid request body" });
        return;
      }

      const { plan_id, notes_for_agent } = parseResult.data;

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

      if (notes_for_agent && notes_for_agent.trim()) {
        appendTicketFeedback(ticketId, "qa", notes_for_agent.trim());
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
        const project =
          getProject(ticket.projectId) ??
          upsertProject(ticket.projectId, {
            name: ticket.projectId,
            workingDirectory: config.codex.workingDirectory ?? process.cwd(),
          });
        const envelope = await runQaForTicket({
          ticketId,
          plan: planEnvelope.payload as PlanPayload,
          executionResults: ticket.executionResults,
          notesForAgent: notes_for_agent ?? undefined,
          workingDirectory: project.workingDirectory,
        });
        res.json({ qa_report: envelope });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to generate QA report";
        res.status(500).json({ error: message });
      }
    },
  );

  registry.registerPath({
    method: "post",
    path: "/api/tickets/{ticketId}/qa",
    tags: ["QA"],
    summary: "Run QA agent for a ticket",
    request: {
      params: z.object({ ticketId: z.string() }),
      body: {
        content: {
          "application/json": {
            schema: QaBodySchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "QA report envelope for the ticket",
        content: {
          "application/json": {
            schema: z.object({
              qa_report: AgentOutputEnvelopeQaReportSchema,
            }),
          },
        },
      },
      400: {
        description:
          "Ticket not ready for QA or invalid request body",
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
      },
      500: {
        description: "Failed to generate QA report",
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
      },
    },
  });

  app.post(
    "/api/tickets/:ticketId/qa/envelope",
    (req: Request, res: Response) => {
      const ticketId = req.params.ticketId;
      const envelope = req.body as AgentOutputEnvelopeQaReport;

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

  registry.registerPath({
    method: "post",
    path: "/api/tickets/{ticketId}/qa/envelope",
    tags: ["QA"],
    summary: "Store a QA report envelope",
    request: {
      params: z.object({ ticketId: z.string() }),
      body: {
        content: {
          "application/json": {
            schema: AgentOutputEnvelopeQaReportSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: "QA report envelope stored",
        content: {
          "application/json": {
            schema: z.object({
              ticket: TicketRecordSchema,
              qa_report: AgentOutputEnvelopeQaReportSchema,
            }),
          },
        },
      },
      400: {
        description: "Invalid envelope",
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
      },
    },
  });

  app.get("/api/tickets/:ticketId/qa", (req: Request, res: Response) => {
    const ticketId = req.params.ticketId;
    const ticket = getTicket(ticketId);
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    res.json({ qa_reports: ticket.qaReports });
  });

  registry.registerPath({
    method: "get",
    path: "/api/tickets/{ticketId}/qa",
    tags: ["QA"],
    summary: "List QA reports for a ticket",
    request: {
      params: z.object({ ticketId: z.string() }),
    },
    responses: {
      200: {
        description: "QA report envelopes for the ticket",
        content: {
          "application/json": {
            schema: z.object({
              qa_reports: z.array(AgentOutputEnvelopeQaReportSchema),
            }),
          },
        },
      },
      404: {
        description: "Ticket not found",
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
      },
    },
  });
}
