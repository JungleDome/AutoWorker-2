import { z } from "zod";

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

export const RequirementTypeSchema = z.enum([
  "feature",
  "bugfix",
  "chore",
  "research",
]);

export const PriorityLevelSchema = z.enum([
  "low",
  "medium",
  "high",
  "critical",
]);

export const OriginTypeSchema = z.enum([
  "user_report",
  "internal",
  "monitoring",
  "other",
]);

export const PlanSufficiencySchema = z.enum(["yes", "partially", "no"]);

export const PlanIssueCategorySchema = z.enum([
  "missing_information",
  "wrong_assumption",
  "over_scoped_step",
  "under_scoped_step",
  "unclear_acceptance_criteria",
  "other",
]);

export const QaStatusSchema = z.enum(["pass", "fail", "partial", "blocked"]);

export const QaCheckStatusSchema = z.enum([
  "pass",
  "fail",
  "not_run",
]);

export const RequirementsSourceSchema = z.object({
  raw_description: z.string(),
  origin: OriginTypeSchema,
  reporter: z.string().nullable(),
});

export const RequirementsClassificationSchema = z.object({
  type: RequirementTypeSchema,
  domain: z.string(),
  priority: PriorityLevelSchema,
  risk_level: RiskLevelSchema,
});

export const AcceptanceCriterionSchema = z.object({
  id: z.string(),
  description: z.string(),
  must_have: z.boolean(),
});

export const RequirementsPayloadSchema = z.object({
  ticket_id: z.string(),
  title: z.string(),
  source: RequirementsSourceSchema,
  classification: RequirementsClassificationSchema,
  problem_statement: z.string(),
  goal_statement: z.string(),
  non_goals: z.array(z.string()),
  context_summary: z.string().nullable(),
  constraints: z.array(z.string()),
  acceptance_criteria: z.array(AcceptanceCriterionSchema),
  dependencies: z.array(z.string()),
  suggested_review_mode: ReviewModeSchema,
  open_questions_for_stakeholders: z.array(z.string()),
  freeform_notes: z.string().nullable(),
});

export const PlanStepSchema: z.ZodType<any> = z
  .lazy(() =>
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      kind: PlanStepKindSchema,
      owner_role: AgentRoleSchema,
      depends_on: z.array(z.string()),
      related_acceptance_criteria: z.array(z.string()),
      risk_level: RiskLevelSchema,
      requires_review: z.boolean(),
      status: PlanStepStatusSchema,
      children: z.array(PlanStepSchema),
    })
  )
  .meta({
    id: "PlanStep",
    type: "object",
  });

export const PlanPayloadSchema = z.object({
  ticket_id: z.string(),
  plan_id: z.string(),
  plan_version: z.number(),
  summary: z.string(),
  overall_risk_level: RiskLevelSchema,
  overall_complexity: ComplexityLevelSchema,
  assumptions: z.array(z.string()),
  risks: z.array(z.string()),
  questions_for_human: z.array(z.string()),
  recommended_review_mode: ReviewModeSchema,
  steps: z.array(PlanStepSchema),
  freeform_notes: z.string().nullable(),
});

export const ExecutionHandledStepSchema = z.object({
  step_id: z.string(),
  previous_status: PlanStepStatusSchema,
  new_status: PlanStepStatusSchema,
  work_summary: z.string(),
  artifacts: z.array(z.string()),
  notes_for_next_run: z.array(z.string()),
});

export const PlanIssueSchema = z.object({
  category: PlanIssueCategorySchema,
  description: z.string(),
  related_steps: z.array(z.string()),
});

export const ExecutionPlanFeedbackSchema = z.object({
  sufficient_for_execution: PlanSufficiencySchema,
  issues: z.array(PlanIssueSchema),
  replan_recommended: z.boolean().nullable(),
});

export const ExecutionHumanReviewSchema = z.object({
  suggested: z.boolean(),
  reason: z.string().nullable(),
  review_focus: z.array(z.string()),
});

export const ExecutionResultPayloadSchema = z.object({
  ticket_id: z.string(),
  plan_id: z.string(),
  handled_steps: z.array(ExecutionHandledStepSchema),
  summary: z.string(),
  status: z.enum(["success", "partial", "failed", "blocked"]),
  time_spent_minutes: z.number().nullable(),
  next_recommended_actions: z.array(z.string()),
  plan_feedback: ExecutionPlanFeedbackSchema,
  human_review: ExecutionHumanReviewSchema,
  blockers: z.array(z.string()),
  questions_for_human: z.array(z.string()),
  freeform_notes: z.string().nullable(),
});

export const QaTestedAcceptanceCriterionSchema = z.object({
  id: z.string(),
  status: QaCheckStatusSchema,
  notes: z.string().nullable(),
});

export const QaCheckSchema = z.object({
  id: z.string(),
  description: z.string(),
  related_steps: z.array(z.string()),
  status: QaCheckStatusSchema,
  details: z.string(),
});

export const QaIssueSchema = z.object({
  id: z.string(),
  severity: PriorityLevelSchema,
  description: z.string(),
  related_steps: z.array(z.string()),
  suspected_cause: z.string().nullable(),
  suggested_fix: z.string().nullable(),
});

export const QaReportPayloadSchema = z.object({
  ticket_id: z.string(),
  plan_id: z.string(),
  overall_status: QaStatusSchema,
  summary: z.string(),
  tested_acceptance_criteria: z.array(QaTestedAcceptanceCriterionSchema),
  checks: z.array(QaCheckSchema),
  issues_found: z.array(QaIssueSchema),
  recommendation: z.string(),
  questions_for_human: z.array(z.string()),
  freeform_notes: z.string().nullable(),
});

const AgentOutputEnvelopeBaseSchemaInternal = z.object({
  agent_role: AgentRoleSchema,
  ticket_id: z.string(),
  run_id: z.string(),
  generated_at: z.string(),
  payload_type: PayloadTypeSchema,
});

export const AgentOutputEnvelopeRequirementsSchema =
  AgentOutputEnvelopeBaseSchemaInternal.extend({
    agent_role: z.literal("Request Owner (Product Manager)"),
    payload_type: z.literal("requirements"),
    payload: RequirementsPayloadSchema,
  });

export const AgentOutputEnvelopePlanSchema =
  AgentOutputEnvelopeBaseSchemaInternal.extend({
    agent_role: z.literal("Planner (Tech Lead)"),
    payload_type: z.literal("plan"),
    payload: PlanPayloadSchema,
  });

export const AgentOutputEnvelopeExecutionResultSchema =
  AgentOutputEnvelopeBaseSchemaInternal.extend({
    agent_role: z.literal("Implementer (Software Engineer)"),
    payload_type: z.literal("execution_result"),
    payload: ExecutionResultPayloadSchema,
  });

export const AgentOutputEnvelopeQaReportSchema =
  AgentOutputEnvelopeBaseSchemaInternal.extend({
    agent_role: z.literal("QA Specialist (QA Engineer)"),
    payload_type: z.literal("qa_report"),
    payload: QaReportPayloadSchema,
  });

export const ProjectRecordSchema = z.object({
  projectId: z.string(),
  name: z.string(),
  workingDirectory: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const TicketRecordSchema = z.object({
  ticketId: z.string(),
  projectId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  latestRequirements: AgentOutputEnvelopeRequirementsSchema.nullable(),
  latestPlan: AgentOutputEnvelopePlanSchema.nullable(),
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

export const AgentOutputEnvelopeBaseSchema = AgentOutputEnvelopeBaseSchemaInternal;
