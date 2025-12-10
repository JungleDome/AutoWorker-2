export type AgentRole =
  | "Request Owner (Product Manager)"
  | "Planner (Tech Lead)"
  | "Implementer (Software Engineer)"
  | "QA Specialist (QA Engineer)";

export type PayloadType =
  | "requirements"
  | "plan"
  | "execution_result"
  | "qa_report";

export interface AgentOutputEnvelope<TPayload> {
  agent_role: AgentRole;
  ticket_id: string;
  run_id: string;
  generated_at: string;
  payload_type: PayloadType;
  payload: TPayload;
}

export type PlanStepStatus =
  | "pending"
  | "in_progress"
  | "done"
  | "blocked"
  | "skipped";

export type PlanStepKind =
  | "analysis"
  | "design"
  | "implementation"
  | "testing"
  | "documentation"
  | "migration";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type ComplexityLevel =
  | "trivial"
  | "simple"
  | "moderate"
  | "complex"
  | "very_complex";

export type ReviewMode = "PLAN_ONLY" | "CRITICAL_STEPS" | "FULL_CONTROL";

export type RequirementType = "feature" | "bugfix" | "chore" | "research";

export type PriorityLevel = "low" | "medium" | "high" | "critical";

export type OriginType = "user_report" | "internal" | "monitoring" | "other";

export interface PlanStep {
  id: string;
  title: string;
  description: string;
  kind: PlanStepKind;
  owner_role: AgentRole;
  depends_on: string[];
  related_acceptance_criteria?: string[];
  risk_level: RiskLevel;
  requires_review: boolean;
  status: PlanStepStatus;
  children: PlanStep[];
}

export interface PlanPayload {
  ticket_id: string;
  plan_id: string;
  plan_version: number;
  summary: string;
  overall_risk_level: RiskLevel;
  overall_complexity: ComplexityLevel;
  assumptions?: string[];
  risks?: string[];
  questions_for_human?: string[];
  recommended_review_mode: ReviewMode;
  steps: PlanStep[];
  freeform_notes?: string;
}

export interface RequirementsSource {
  raw_description: string;
  origin: OriginType;
  reporter?: string;
}

export interface RequirementsClassification {
  type: RequirementType;
  domain: string;
  priority: PriorityLevel;
  risk_level: RiskLevel;
}

export interface AcceptanceCriterion {
  id: string;
  description: string;
  must_have: boolean;
}

export interface RequirementsPayload {
  ticket_id: string;
  title: string;
  source: RequirementsSource;
  classification: RequirementsClassification;
  problem_statement: string;
  goal_statement: string;
  non_goals?: string[];
  context_summary?: string;
  constraints?: string[];
  acceptance_criteria: AcceptanceCriterion[];
  dependencies?: string[];
  suggested_review_mode: ReviewMode;
  open_questions_for_stakeholders?: string[];
  freeform_notes?: string;
}

export interface ExecutionHandledStep {
  step_id: string;
  previous_status: PlanStepStatus;
  new_status: PlanStepStatus;
  work_summary: string;
  artifacts?: string[];
  notes_for_next_run?: string;
}

export type PlanSufficiency = "yes" | "partially" | "no";

export type PlanIssueCategory =
  | "missing_information"
  | "wrong_assumption"
  | "over_scoped_step"
  | "under_scoped_step"
  | "unclear_acceptance_criteria"
  | "other";

export interface PlanIssue {
  category: PlanIssueCategory;
  description: string;
  related_steps?: string[];
}

export interface ExecutionPlanFeedback {
  sufficient_for_execution: PlanSufficiency;
  issues?: PlanIssue[];
  replan_recommended?: boolean;
}

export interface ExecutionHumanReview {
  suggested: boolean;
  reason?: string;
  review_focus?: string[];
}

export interface ExecutionResultPayload {
  ticket_id: string;
  plan_id: string;
  handled_steps: ExecutionHandledStep[];
  summary: string;
  status: "success" | "partial" | "failed" | "blocked";
  time_spent_minutes?: number;
  next_recommended_actions?: string[];
  plan_feedback: ExecutionPlanFeedback;
  human_review: ExecutionHumanReview;
  blockers?: string[];
  questions_for_human?: string[];
  freeform_notes?: string;
}

export type QaStatus = "pass" | "fail" | "partial" | "blocked";

export type QaCheckStatus = "pass" | "fail" | "not_run";

export interface QaTestedAcceptanceCriterion {
  id: string;
  status: QaCheckStatus;
  notes?: string;
}

export interface QaCheck {
  id: string;
  description: string;
  related_steps?: string[];
  status: QaCheckStatus;
  details: string;
}

export interface QaIssue {
  id: string;
  severity: PriorityLevel;
  description: string;
  related_steps?: string[];
  suspected_cause?: string;
  suggested_fix?: string;
}

export interface QaReportPayload {
  ticket_id: string;
  plan_id: string;
  overall_status: QaStatus;
  summary: string;
  tested_acceptance_criteria?: QaTestedAcceptanceCriterion[];
  checks?: QaCheck[];
  issues_found?: QaIssue[];
  recommendation: string;
  questions_for_human?: string[];
  freeform_notes?: string;
}
