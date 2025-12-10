import { z } from "zod";
import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  extendZodWithOpenApi,
} from "@asteasolutions/zod-to-openapi";
import {
  AgentOutputEnvelopeExecutionResultSchema,
  AgentOutputEnvelopePlanSchema,
  AgentOutputEnvelopeQaReportSchema,
  AgentOutputEnvelopeRequirementsSchema,
  ErrorResponseSchema,
  PlanPayloadSchema,
  TicketRecordSchema,
} from "../models/domainSchemas.js";

extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

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

export {
  z,
  TicketRecordSchema,
  AgentOutputEnvelopeRequirementsSchema,
  AgentOutputEnvelopePlanSchema,
  AgentOutputEnvelopeExecutionResultSchema,
  AgentOutputEnvelopeQaReportSchema,
  ErrorResponseSchema,
  PlanPayloadSchema,
};

