import { toJSONSchema } from "zod";
import {
  AgentOutputEnvelopeExecutionResultSchema,
  AgentOutputEnvelopePlanSchema,
  AgentOutputEnvelopeQaReportSchema,
  AgentOutputEnvelopeRequirementsSchema,
} from "./domainSchemas.js";
import { toCodexStrictSchema } from "./codexSchema.js";

const draft7 = { target: "draft-7" } as const;

export const RequirementsOutputSchema = toJSONSchema(
  AgentOutputEnvelopeRequirementsSchema,
  draft7,
);

export const PlanOutputSchema = toJSONSchema(
  AgentOutputEnvelopePlanSchema,
  draft7,
);

export const ExecutionResultOutputSchema = toJSONSchema(
  AgentOutputEnvelopeExecutionResultSchema,
  draft7,
);

export const QaReportOutputSchema = toJSONSchema(
  AgentOutputEnvelopeQaReportSchema,
  draft7,
);

export const RequirementsOutputSchemaStrict = toCodexStrictSchema(
  RequirementsOutputSchema,
);
export const PlanOutputSchemaStrict = toCodexStrictSchema(PlanOutputSchema);
export const ExecutionResultOutputSchemaStrict = toCodexStrictSchema(
  ExecutionResultOutputSchema,
);
export const QaReportOutputSchemaStrict = toCodexStrictSchema(
  QaReportOutputSchema,
);
