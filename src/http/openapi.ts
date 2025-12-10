import { z } from "zod";
import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  extendZodWithOpenApi,
} from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

export const AgentRoleSchema = z.enum([
  "Request Owner (Product Manager)",
  "Planner (Tech Lead)",
  "Implementer (Software Engineer)",
  "QA Specialist (QA Engineer)",
]);

export const PayloadTypeSchema = z.enum([
  "requirements",
  "plan",
  "execution_result",
  "qa_report",
]);

export const PlanStepStatusSchema = z.enum([
  "pending",
  "in_progress",
  "done",
  "blocked",
  "skipped",
]);

export const PlanStepKindSchema = z.enum([
  "analysis",
  "design",
  "implementation",
  "testing",
  "documentation",
  "migration",
]);

export const RiskLevelSchema = z.enum([
  "low",
  "medium",
  "high",
  "critical",
]);

export const ComplexityLevelSchema = z.enum([
  "trivial",
  "simple",
  "moderate",
  "complex",
  "very_complex",
]);

export const ReviewModeSchema = z.enum([
  "PLAN_ONLY",
  "CRITICAL_STEPS",
  "FULL_CONTROL",
]);

export const PlanStepSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  kind: PlanStepKindSchema,
  owner_role: AgentRoleSchema,
  depends_on: z.array(z.string()),
  related_acceptance_criteria: z.array(z.string()).optional(),
  risk_level: RiskLevelSchema,
  requires_review: z.boolean(),
  status: PlanStepStatusSchema,
  // For OpenAPI we avoid recursive lazy schemas and just treat children
  // as an array of generic plan-step-like objects.
  children: z.array(z.record(z.string(), z.unknown())),
});

export const PlanPayloadSchema = z.object({
  ticket_id: z.string(),
  plan_id: z.string(),
  plan_version: z.number(),
  summary: z.string(),
  overall_risk_level: RiskLevelSchema,
  overall_complexity: ComplexityLevelSchema,
  assumptions: z.array(z.string()).optional(),
  risks: z.array(z.string()).optional(),
  questions_for_human: z.array(z.string()).optional(),
  recommended_review_mode: ReviewModeSchema,
  steps: z.array(PlanStepSchema),
  freeform_notes: z.string().optional(),
});

export const RequirementsPayloadSchema = z.record(z.string(), z.unknown());

export const ExecutionResultPayloadSchema = z.record(z.string(), z.unknown());

export const QaReportPayloadSchema = z.record(z.string(), z.unknown());

const AgentOutputEnvelopeBase = z.object({
  agent_role: AgentRoleSchema,
  ticket_id: z.string(),
  run_id: z.string(),
  generated_at: z.string(),
  payload_type: PayloadTypeSchema,
});

export const AgentOutputEnvelopeRequirementsSchema = AgentOutputEnvelopeBase.extend(
  {
    payload: RequirementsPayloadSchema,
  },
);

export const AgentOutputEnvelopePlanSchema = AgentOutputEnvelopeBase.extend({
  payload: PlanPayloadSchema,
});

export const AgentOutputEnvelopeExecutionResultSchema =
  AgentOutputEnvelopeBase.extend({
    payload: ExecutionResultPayloadSchema,
  });

export const AgentOutputEnvelopeQaReportSchema = AgentOutputEnvelopeBase.extend(
  {
    payload: QaReportPayloadSchema,
  },
);

export const TicketRecordSchema = z.object({
  ticketId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  latestRequirements: AgentOutputEnvelopeRequirementsSchema.optional(),
  latestPlan: AgentOutputEnvelopePlanSchema.optional(),
  planHistory: z.array(AgentOutputEnvelopePlanSchema),
  executionResults: z.array(AgentOutputEnvelopeExecutionResultSchema),
  qaReports: z.array(AgentOutputEnvelopeQaReportSchema),
  feedback: z.object({
    requirements: z.array(z.string()),
    plan: z.array(z.string()),
    execution: z.array(z.string()),
    qa: z.array(z.string()),
  }),
});

export const ErrorResponseSchema = z.object({
  error: z.string(),
});

export function generateOpenApiDocument() {
  const generator = new OpenApiGeneratorV3(registry.definitions);

  return generator.generateDocument({
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
  });
}

export { z };
