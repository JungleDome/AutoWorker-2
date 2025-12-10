export const openApiSpec = {
  openapi: "3.0.0",
  info: {
    title: "AutoWorker API",
    version: "1.0.0",
    description:
      "API for managing tickets and agent outputs (requirements, plans, execution, QA) in AutoWorker.",
  },
  servers: [
    {
      url: "http://localhost:3000",
      description: "Local development server",
    },
  ],
  paths: {
    "/health": {
      get: {
        summary: "Health check",
        tags: ["System"],
        responses: {
          "200": {
            description: "Service is healthy",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: {
                      type: "string",
                      example: "ok",
                    },
                  },
                  required: ["status"],
                },
              },
            },
          },
        },
      },
    },
    "/api/tickets": {
      get: {
        summary: "List tickets",
        tags: ["Tickets"],
        responses: {
          "200": {
            description: "List of tickets",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    tickets: {
                      type: "array",
                      items: { $ref: "#/components/schemas/TicketRecord" },
                    },
                  },
                  required: ["tickets"],
                },
              },
            },
          },
        },
      },
    },
    "/api/tickets/{ticketId}": {
      parameters: [
        {
          name: "ticketId",
          in: "path",
          required: true,
          description: "Ticket identifier (for example, T-123).",
          schema: { type: "string" },
        },
      ],
      get: {
        summary: "Get ticket by ID",
        tags: ["Tickets"],
        responses: {
          "200": {
            description: "Ticket details",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ticket: { $ref: "#/components/schemas/TicketRecord" },
                  },
                  required: ["ticket"],
                },
              },
            },
          },
          "404": {
            description: "Ticket not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      post: {
        summary: "Create or update a ticket shell",
        description:
          "Ensures a ticket record exists for the given ticketId (no body required).",
        tags: ["Tickets"],
        responses: {
          "201": {
            description: "Ticket created or updated",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ticket: { $ref: "#/components/schemas/TicketRecord" },
                  },
                  required: ["ticket"],
                },
              },
            },
          },
        },
      },
    },
    "/api/tickets/{ticketId/requirements}": {
      post: {
        summary: "Run requirements agent for a ticket",
        description:
          "Triggers the Requirements agent to structure a raw ticket description.",
        tags: ["Requirements"],
        parameters: [
          {
            name: "ticketId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  raw_description: { type: "string" },
                  notes_for_agent: { type: "string" },
                },
                required: ["raw_description"],
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Requirements envelope for the ticket",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    requirements: {
                      $ref: "#/components/schemas/AgentOutputEnvelope_Requirements",
                    },
                  },
                  required: ["requirements"],
                },
              },
            },
          },
          "400": {
            description: "Invalid request",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "500": {
            description: "Failed to generate requirements",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      get: {
        summary: "Get latest requirements for a ticket",
        tags: ["Requirements"],
        parameters: [
          {
            name: "ticketId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Latest requirements envelope for the ticket",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    requirements: {
                      $ref: "#/components/schemas/AgentOutputEnvelope_Requirements",
                    },
                  },
                  required: ["requirements"],
                },
              },
            },
          },
          "404": {
            description: "No requirements found for ticket",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/tickets/{ticketId}/requirements/envelope": {
      post: {
        summary: "Store a requirements envelope",
        description:
          "Manually records a Requirements envelope, for example when replaying a previous run.",
        tags: ["Requirements"],
        parameters: [
          {
            name: "ticketId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/AgentOutputEnvelope_Requirements",
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Requirements envelope stored",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ticket: { $ref: "#/components/schemas/TicketRecord" },
                    requirements: {
                      $ref: "#/components/schemas/AgentOutputEnvelope_Requirements",
                    },
                  },
                  required: ["ticket", "requirements"],
                },
              },
            },
          },
          "400": {
            description: "Invalid envelope",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/tickets/{ticketId}/plan": {
      post: {
        summary: "Run planner agent for a ticket",
        description:
          "Triggers the Planner (Tech Lead) to generate a plan for a ticket. Ticket must already have requirements.",
        tags: ["Planning"],
        parameters: [
          {
            name: "ticketId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  notes_for_agent: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Plan envelope for the ticket",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    plan: {
                      $ref: "#/components/schemas/AgentOutputEnvelope_Plan",
                    },
                  },
                  required: ["plan"],
                },
              },
            },
          },
          "400": {
            description:
              "Ticket not ready for planning or invalid request body",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "500": {
            description: "Failed to generate plan",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      get: {
        summary: "Get latest plan for a ticket",
        tags: ["Planning"],
        parameters: [
          {
            name: "ticketId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Latest plan envelope for the ticket",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    plan: {
                      $ref: "#/components/schemas/AgentOutputEnvelope_Plan",
                    },
                  },
                  required: ["plan"],
                },
              },
            },
          },
          "404": {
            description: "No plan found for ticket",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/tickets/{ticketId}/plan/envelope": {
      post: {
        summary: "Store a plan envelope",
        description:
          "Manually records a Plan envelope, for example when replaying a previous run.",
        tags: ["Planning"],
        parameters: [
          {
            name: "ticketId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/AgentOutputEnvelope_Plan",
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Plan envelope stored",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ticket: { $ref: "#/components/schemas/TicketRecord" },
                    plan: {
                      $ref: "#/components/schemas/AgentOutputEnvelope_Plan",
                    },
                  },
                  required: ["ticket", "plan"],
                },
              },
            },
          },
          "400": {
            description: "Invalid envelope",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/tickets/{ticketId}/execution": {
      post: {
        summary: "Run implementer agent for a ticket",
        description:
          "Triggers the Implementer (Software Engineer) to execute a plan or subset of steps.",
        tags: ["Execution"],
        parameters: [
          {
            name: "ticketId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  plan_id: { type: "string" },
                  step_ids: {
                    type: "array",
                    items: { type: "string" },
                  },
                  notes_for_agent: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Execution result envelope for the ticket",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    execution: {
                      $ref: "#/components/schemas/AgentOutputEnvelope_ExecutionResult",
                    },
                  },
                  required: ["execution"],
                },
              },
            },
          },
          "400": {
            description:
              "Ticket not ready for execution or invalid request body",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "500": {
            description: "Failed to generate execution result",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      get: {
        summary: "List execution results for a ticket",
        tags: ["Execution"],
        parameters: [
          {
            name: "ticketId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Execution result envelopes for the ticket",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    executions: {
                      type: "array",
                      items: {
                        $ref: "#/components/schemas/AgentOutputEnvelope_ExecutionResult",
                      },
                    },
                  },
                  required: ["executions"],
                },
              },
            },
          },
          "404": {
            description: "Ticket not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/tickets/{ticketId}/execution/envelope": {
      post: {
        summary: "Store an execution_result envelope",
        description:
          "Manually records an Execution Result envelope, for example when replaying a previous run.",
        tags: ["Execution"],
        parameters: [
          {
            name: "ticketId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/AgentOutputEnvelope_ExecutionResult",
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Execution result envelope stored",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ticket: { $ref: "#/components/schemas/TicketRecord" },
                    execution: {
                      $ref: "#/components/schemas/AgentOutputEnvelope_ExecutionResult",
                    },
                  },
                  required: ["ticket", "execution"],
                },
              },
            },
          },
          "400": {
            description: "Invalid envelope",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/tickets/{ticketId}/qa": {
      post: {
        summary: "Run QA agent for a ticket",
        description:
          "Triggers the QA Specialist to review a plan and execution results.",
        tags: ["QA"],
        parameters: [
          {
            name: "ticketId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  plan_id: { type: "string" },
                  notes_for_agent: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "QA report envelope for the ticket",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    qa_report: {
                      $ref: "#/components/schemas/AgentOutputEnvelope_QaReport",
                    },
                  },
                  required: ["qa_report"],
                },
              },
            },
          },
          "400": {
            description:
              "Ticket not ready for QA or invalid request body",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "500": {
            description: "Failed to generate QA report",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      get: {
        summary: "List QA reports for a ticket",
        tags: ["QA"],
        parameters: [
          {
            name: "ticketId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "QA report envelopes for the ticket",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    qa_reports: {
                      type: "array",
                      items: {
                        $ref: "#/components/schemas/AgentOutputEnvelope_QaReport",
                      },
                    },
                  },
                  required: ["qa_reports"],
                },
              },
            },
          },
          "404": {
            description: "Ticket not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/tickets/{ticketId}/qa/envelope": {
      post: {
        summary: "Store a QA report envelope",
        description:
          "Manually records a QA Report envelope, for example when replaying a previous run.",
        tags: ["QA"],
        parameters: [
          {
            name: "ticketId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/AgentOutputEnvelope_QaReport",
              },
            },
          },
        },
        responses: {
          "201": {
            description: "QA report envelope stored",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ticket: { $ref: "#/components/schemas/TicketRecord" },
                    qa_report: {
                      $ref: "#/components/schemas/AgentOutputEnvelope_QaReport",
                    },
                  },
                  required: ["ticket", "qa_report"],
                },
              },
            },
          },
          "400": {
            description: "Invalid envelope",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      ErrorResponse: {
        type: "object",
        properties: {
          error: { type: "string" },
        },
        required: ["error"],
      },
      AgentRole: {
        type: "string",
        enum: [
          "Request Owner (Product Manager)",
          "Planner (Tech Lead)",
          "Implementer (Software Engineer)",
          "QA Specialist (QA Engineer)",
        ],
      },
      PayloadType: {
        type: "string",
        enum: ["requirements", "plan", "execution_result", "qa_report"],
      },
      PlanStepStatus: {
        type: "string",
        enum: ["pending", "in_progress", "done", "blocked", "skipped"],
      },
      PlanStepKind: {
        type: "string",
        enum: [
          "analysis",
          "design",
          "implementation",
          "testing",
          "documentation",
          "migration",
        ],
      },
      RiskLevel: {
        type: "string",
        enum: ["low", "medium", "high", "critical"],
      },
      ComplexityLevel: {
        type: "string",
        enum: ["trivial", "simple", "moderate", "complex", "very_complex"],
      },
      ReviewMode: {
        type: "string",
        enum: ["PLAN_ONLY", "CRITICAL_STEPS", "FULL_CONTROL"],
      },
      PlanStep: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          kind: { $ref: "#/components/schemas/PlanStepKind" },
          owner_role: { $ref: "#/components/schemas/AgentRole" },
          depends_on: {
            type: "array",
            items: { type: "string" },
          },
          related_acceptance_criteria: {
            type: "array",
            items: { type: "string" },
          },
          risk_level: { $ref: "#/components/schemas/RiskLevel" },
          requires_review: { type: "boolean" },
          status: { $ref: "#/components/schemas/PlanStepStatus" },
          children: {
            type: "array",
            items: { $ref: "#/components/schemas/PlanStep" },
          },
        },
        required: [
          "id",
          "title",
          "description",
          "kind",
          "owner_role",
          "depends_on",
          "risk_level",
          "requires_review",
          "status",
          "children",
        ],
      },
      PlanPayload: {
        type: "object",
        properties: {
          ticket_id: { type: "string" },
          plan_id: { type: "string" },
          plan_version: { type: "integer", format: "int32" },
          summary: { type: "string" },
          overall_risk_level: { $ref: "#/components/schemas/RiskLevel" },
          overall_complexity: {
            $ref: "#/components/schemas/ComplexityLevel",
          },
          assumptions: {
            type: "array",
            items: { type: "string" },
          },
          risks: {
            type: "array",
            items: { type: "string" },
          },
          questions_for_human: {
            type: "array",
            items: { type: "string" },
          },
          recommended_review_mode: {
            $ref: "#/components/schemas/ReviewMode",
          },
          steps: {
            type: "array",
            items: { $ref: "#/components/schemas/PlanStep" },
          },
          freeform_notes: { type: "string" },
        },
        required: [
          "ticket_id",
          "plan_id",
          "plan_version",
          "summary",
          "overall_risk_level",
          "overall_complexity",
          "recommended_review_mode",
          "steps",
        ],
      },
      RequirementsPayload: {
        type: "object",
        description:
          "Requirements payload (structure may evolve; treated as generic JSON).",
        additionalProperties: true,
      },
      ExecutionResultPayload: {
        type: "object",
        description:
          "Execution result payload (structure may evolve; treated as generic JSON).",
        additionalProperties: true,
      },
      QaReportPayload: {
        type: "object",
        description:
          "QA report payload (structure may evolve; treated as generic JSON).",
        additionalProperties: true,
      },
      AgentOutputEnvelope_Requirements: {
        type: "object",
        properties: {
          agent_role: { $ref: "#/components/schemas/AgentRole" },
          ticket_id: { type: "string" },
          run_id: { type: "string" },
          generated_at: { type: "string", format: "date-time" },
          payload_type: { $ref: "#/components/schemas/PayloadType" },
          payload: { $ref: "#/components/schemas/RequirementsPayload" },
        },
        required: [
          "agent_role",
          "ticket_id",
          "run_id",
          "generated_at",
          "payload_type",
          "payload",
        ],
      },
      AgentOutputEnvelope_Plan: {
        type: "object",
        properties: {
          agent_role: { $ref: "#/components/schemas/AgentRole" },
          ticket_id: { type: "string" },
          run_id: { type: "string" },
          generated_at: { type: "string", format: "date-time" },
          payload_type: { $ref: "#/components/schemas/PayloadType" },
          payload: { $ref: "#/components/schemas/PlanPayload" },
        },
        required: [
          "agent_role",
          "ticket_id",
          "run_id",
          "generated_at",
          "payload_type",
          "payload",
        ],
      },
      AgentOutputEnvelope_ExecutionResult: {
        type: "object",
        properties: {
          agent_role: { $ref: "#/components/schemas/AgentRole" },
          ticket_id: { type: "string" },
          run_id: { type: "string" },
          generated_at: { type: "string", format: "date-time" },
          payload_type: { $ref: "#/components/schemas/PayloadType" },
          payload: { $ref: "#/components/schemas/ExecutionResultPayload" },
        },
        required: [
          "agent_role",
          "ticket_id",
          "run_id",
          "generated_at",
          "payload_type",
          "payload",
        ],
      },
      AgentOutputEnvelope_QaReport: {
        type: "object",
        properties: {
          agent_role: { $ref: "#/components/schemas/AgentRole" },
          ticket_id: { type: "string" },
          run_id: { type: "string" },
          generated_at: { type: "string", format: "date-time" },
          payload_type: { $ref: "#/components/schemas/PayloadType" },
          payload: { $ref: "#/components/schemas/QaReportPayload" },
        },
        required: [
          "agent_role",
          "ticket_id",
          "run_id",
          "generated_at",
          "payload_type",
          "payload",
        ],
      },
      TicketRecord: {
        type: "object",
        properties: {
          ticketId: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          latestRequirements: {
            $ref: "#/components/schemas/AgentOutputEnvelope_Requirements",
          },
          latestPlan: {
            $ref: "#/components/schemas/AgentOutputEnvelope_Plan",
          },
          planHistory: {
            type: "array",
            items: { $ref: "#/components/schemas/AgentOutputEnvelope_Plan" },
          },
          executionResults: {
            type: "array",
            items: {
              $ref: "#/components/schemas/AgentOutputEnvelope_ExecutionResult",
            },
          },
          qaReports: {
            type: "array",
            items: {
              $ref: "#/components/schemas/AgentOutputEnvelope_QaReport",
            },
          },
        },
        required: ["ticketId", "createdAt", "updatedAt", "planHistory", "executionResults", "qaReports"],
      },
    },
  },
} as const;

