import { z } from "zod";

export const AgentRoleSchema = z.enum([
  "Request Owner (Product Manager)",
  "Planner (Tech Lead)",
  "Implementer (Software Engineer)",
  "QA Specialist (QA Engineer)",
]);

export const PayloadTypeSchema = z.enum(["requirements", "plan", "execution_result", "qa_report"]);

export const PlanStepStatusSchema = z.enum(["pending", "in_progress", "done", "blocked", "skipped"]);

export const PlanStepKindSchema = z.enum(["analysis", "design", "implementation", "testing", "documentation", "migration"]);

export const RiskLevelSchema = z.enum(["low", "medium", "high", "critical"]);

export const ComplexityLevelSchema = z.enum(["trivial", "simple", "moderate", "complex", "very_complex"]);

export const ReviewModeSchema = z.enum(["PLAN_ONLY", "CRITICAL_STEPS", "FULL_CONTROL"]);

export const RequirementTypeSchema = z.enum(["feature", "bugfix", "chore", "research"]);

export const PriorityLevelSchema = z.enum(["low", "medium", "high", "critical"]);

export const OriginTypeSchema = z.enum(["user_report", "internal", "monitoring", "other"]);

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

export const QaCheckStatusSchema = z.enum(["pass", "fail", "not_run"]);

export const RequirementsSourceSchema = z.object({
  raw_description: z.string(),
  origin: OriginTypeSchema,
  reporter: z.string().optional(),
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
  non_goals: z.array(z.string()).optional(),
  context_summary: z.string().optional(),
  constraints: z.array(z.string()).optional(),
  acceptance_criteria: z.array(AcceptanceCriterionSchema),
  dependencies: z.array(z.string()).optional(),
  suggested_review_mode: ReviewModeSchema,
  open_questions_for_stakeholders: z.array(z.string()).optional(),
  freeform_notes: z.string().optional(),
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
      related_acceptance_criteria: z.array(z.string()).optional(),
      risk_level: RiskLevelSchema,
      requires_review: z.boolean(),
      status: PlanStepStatusSchema,
      children: z.array(PlanStepSchema),
    }),
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
  assumptions: z.array(z.string()).optional(),
  risks: z.array(z.string()).optional(),
  questions_for_human: z.array(z.string()).optional(),
  recommended_review_mode: ReviewModeSchema,
  steps: z.array(PlanStepSchema),
  freeform_notes: z.string().optional(),
});

export const ExecutionHandledStepSchema = z.object({
  step_id: z.string(),
  previous_status: PlanStepStatusSchema,
  new_status: PlanStepStatusSchema,
  work_summary: z.string(),
  artifacts: z.array(z.string()).optional(),
  notes_for_next_run: z.array(z.string()).optional(),
});

export const PlanIssueSchema = z.object({
  category: PlanIssueCategorySchema,
  description: z.string(),
  related_steps: z.array(z.string()).optional(),
});

export const ExecutionPlanFeedbackSchema = z.object({
  sufficient_for_execution: PlanSufficiencySchema,
  issues: z.array(PlanIssueSchema).optional(),
  replan_recommended: z.boolean().optional(),
});

export const ExecutionHumanReviewSchema = z.object({
  suggested: z.boolean(),
  reason: z.string().optional(),
  review_focus: z.array(z.string()).optional(),
});

export const ExecutionResultPayloadSchema = z.object({
  ticket_id: z.string(),
  plan_id: z.string(),
  handled_steps: z.array(ExecutionHandledStepSchema),
  summary: z.string(),
  status: z.enum(["success", "partial", "failed", "blocked"]),
  time_spent_minutes: z.number().optional(),
  next_recommended_actions: z.array(z.string()).optional(),
  plan_feedback: ExecutionPlanFeedbackSchema,
  human_review: ExecutionHumanReviewSchema,
  blockers: z.array(z.string()).optional(),
  questions_for_human: z.array(z.string()).optional(),
  freeform_notes: z.string().optional(),
});

export const QaTestedAcceptanceCriterionSchema = z.object({
  id: z.string(),
  status: QaCheckStatusSchema,
  notes: z.string().optional(),
});

export const QaCheckSchema = z.object({
  id: z.string(),
  description: z.string(),
  related_steps: z.array(z.string()).optional(),
  status: QaCheckStatusSchema,
  details: z.string(),
});

export const QaIssueSchema = z.object({
  id: z.string(),
  severity: PriorityLevelSchema,
  description: z.string(),
  related_steps: z.array(z.string()).optional(),
  suspected_cause: z.string().optional(),
  suggested_fix: z.string().optional(),
});

export const QaReportPayloadSchema = z.object({
  ticket_id: z.string(),
  plan_id: z.string(),
  overall_status: QaStatusSchema,
  summary: z.string(),
  tested_acceptance_criteria: z.array(QaTestedAcceptanceCriterionSchema).optional(),
  checks: z.array(QaCheckSchema).optional(),
  issues_found: z.array(QaIssueSchema).optional(),
  recommendation: z.string(),
  questions_for_human: z.array(z.string()).optional(),
  freeform_notes: z.string().optional(),
});

const AgentOutputEnvelopeBaseSchemaInternal = z.object({
  agent_role: AgentRoleSchema,
  ticket_id: z.string(),
  run_id: z.string(),
  generated_at: z.string(),
  payload_type: PayloadTypeSchema,
});

export const AgentOutputEnvelopeRequirementsSchema = AgentOutputEnvelopeBaseSchemaInternal.extend({
  payload: RequirementsPayloadSchema,
});

export const AgentOutputEnvelopePlanSchema = AgentOutputEnvelopeBaseSchemaInternal.extend({
  payload: PlanPayloadSchema,
});

export const AgentOutputEnvelopeExecutionResultSchema = AgentOutputEnvelopeBaseSchemaInternal.extend({
  payload: ExecutionResultPayloadSchema,
});

export const AgentOutputEnvelopeQaReportSchema = AgentOutputEnvelopeBaseSchemaInternal.extend({
  payload: QaReportPayloadSchema,
});

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

export const AgentOutputEnvelopeBaseSchema = AgentOutputEnvelopeBaseSchemaInternal;
