import { z } from "zod";
import {
  AcceptanceCriterionSchema,
  AgentOutputEnvelopeBaseSchema,
  AgentOutputEnvelopeExecutionResultSchema,
  AgentOutputEnvelopePlanSchema,
  AgentOutputEnvelopeQaReportSchema,
  AgentOutputEnvelopeRequirementsSchema,
  AgentRoleSchema,
  ComplexityLevelSchema,
  ExecutionHandledStepSchema,
  ExecutionHumanReviewSchema,
  ExecutionPlanFeedbackSchema,
  ExecutionResultPayloadSchema,
  OriginTypeSchema,
  PayloadTypeSchema,
  PlanIssueCategorySchema,
  PlanIssueSchema,
  PlanPayloadSchema,
  PlanSufficiencySchema,
  PlanStepKindSchema,
  PlanStepSchema,
  PlanStepStatusSchema,
  PriorityLevelSchema,
  ProjectRecordSchema,
  QaCheckSchema,
  QaCheckStatusSchema,
  QaIssueSchema,
  QaReportPayloadSchema,
  QaStatusSchema,
  QaTestedAcceptanceCriterionSchema,
  RequirementTypeSchema,
  RequirementsClassificationSchema,
  RequirementsPayloadSchema,
  RequirementsSourceSchema,
  ReviewModeSchema,
  RiskLevelSchema,
  TicketStatusSchema,
  TicketRecordSchema,
  AskRecordSchema,
} from "./domainSchemas.js";

export type AgentRole = z.infer<typeof AgentRoleSchema>;

export type PayloadType = z.infer<typeof PayloadTypeSchema>;

export type PlanStepStatus = z.infer<typeof PlanStepStatusSchema>;

export type PlanStepKind = z.infer<typeof PlanStepKindSchema>;

export type RiskLevel = z.infer<typeof RiskLevelSchema>;

export type ComplexityLevel = z.infer<typeof ComplexityLevelSchema>;

export type ReviewMode = z.infer<typeof ReviewModeSchema>;

export type RequirementType = z.infer<typeof RequirementTypeSchema>;

export type PriorityLevel = z.infer<typeof PriorityLevelSchema>;

export type OriginType = z.infer<typeof OriginTypeSchema>;

export type PlanSufficiency = z.infer<typeof PlanSufficiencySchema>;

export type PlanIssueCategory = z.infer<typeof PlanIssueCategorySchema>;

export type QaStatus = z.infer<typeof QaStatusSchema>;

export type QaCheckStatus = z.infer<typeof QaCheckStatusSchema>;

export type RequirementsSource = z.infer<typeof RequirementsSourceSchema>;

export type RequirementsClassification = z.infer<
  typeof RequirementsClassificationSchema
>;

export type AcceptanceCriterion = z.infer<typeof AcceptanceCriterionSchema>;

export type RequirementsPayload = z.infer<typeof RequirementsPayloadSchema>;

export type PlanStep = z.infer<typeof PlanStepSchema>;

export type PlanPayload = z.infer<typeof PlanPayloadSchema>;

export type ExecutionHandledStep = z.infer<typeof ExecutionHandledStepSchema>;

export type PlanIssue = z.infer<typeof PlanIssueSchema>;

export type ExecutionPlanFeedback = z.infer<typeof ExecutionPlanFeedbackSchema>;

export type ExecutionHumanReview = z.infer<typeof ExecutionHumanReviewSchema>;

export type ExecutionResultPayload = z.infer<
  typeof ExecutionResultPayloadSchema
>;

export type QaTestedAcceptanceCriterion = z.infer<
  typeof QaTestedAcceptanceCriterionSchema
>;

export type QaCheck = z.infer<typeof QaCheckSchema>;

export type QaIssue = z.infer<typeof QaIssueSchema>;

export type QaReportPayload = z.infer<typeof QaReportPayloadSchema>;

export type TicketRecord = z.infer<typeof TicketRecordSchema>;

export type TicketStatus = z.infer<typeof TicketStatusSchema>;

export type ProjectRecord = z.infer<typeof ProjectRecordSchema>;

export type AskRecord = z.infer<typeof AskRecordSchema>;

export type AgentOutputEnvelopeBase = z.infer<
  typeof AgentOutputEnvelopeBaseSchema
>;

export interface AgentOutputEnvelope<TPayload> extends AgentOutputEnvelopeBase {
  payload: TPayload;
}

export type AgentOutputEnvelopeRequirements = z.infer<
  typeof AgentOutputEnvelopeRequirementsSchema
>;

export type AgentOutputEnvelopePlan = z.infer<
  typeof AgentOutputEnvelopePlanSchema
>;

export type AgentOutputEnvelopeExecutionResult = z.infer<
  typeof AgentOutputEnvelopeExecutionResultSchema
>;

export type AgentOutputEnvelopeQaReport = z.infer<
  typeof AgentOutputEnvelopeQaReportSchema
>;
