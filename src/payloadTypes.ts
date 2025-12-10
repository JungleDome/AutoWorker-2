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

// For now we model other payloads as untyped JSON until we need to inspect them.
export type RequirementsPayload = Record<string, unknown>;
export type ExecutionResultPayload = Record<string, unknown>;
export type QaReportPayload = Record<string, unknown>;

