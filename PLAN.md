# AutoWorker Domain Modeling Plan

## Goal

- Use Zod schemas as the single source of truth for all domain models (enums, payloads, envelopes, ticket records).
- Derive TypeScript types from those schemas and reuse them across agents, storage, and HTTP routes.
- Centralize OpenAPI generation on top of the same Zod schemas.

## Design

- **Schemas vs Types**
  - Runtime validation + OpenAPI: `PascalCaseSchema` (e.g. `PlanPayloadSchema`).
  - Static TypeScript types: `PascalCase` (e.g. `PlanPayload`), defined via `z.infer<typeof PlanPayloadSchema>`.
  - Generic envelope type: `AgentOutputEnvelope<TPayload>` is derived from a base Zod schema.

- **Folder Layout**
  - `src/models/domainSchemas.ts`
    - All Zod schemas for:
      - Core enums: `AgentRoleSchema`, `PayloadTypeSchema`, `PlanStepStatusSchema`, etc.
      - Payloads: `RequirementsPayloadSchema`, `PlanPayloadSchema`, `ExecutionResultPayloadSchema`, `QaReportPayloadSchema`.
      - Supporting structures: `RequirementsSourceSchema`, `RequirementsClassificationSchema`, `PlanStepSchema`, `ExecutionHandledStepSchema`, `QaIssueSchema`, etc.
      - Envelopes: `AgentOutputEnvelopeRequirementsSchema`, `AgentOutputEnvelopePlanSchema`, `AgentOutputEnvelopeExecutionResultSchema`, `AgentOutputEnvelopeQaReportSchema`.
      - Storage: `TicketRecordSchema`, `ErrorResponseSchema`.
  - `src/models/domainTypes.ts`
    - All domain TypeScript types derived via `z.infer`, plus:
      - Generic `AgentOutputEnvelope<TPayload>`.
      - Concrete envelope types for each payload kind.
  - `src/http/openapiRegistry.ts`
    - Owns `OpenAPIRegistry`, `extendZodWithOpenApi`, and `generateOpenApiDocument`.
    - Imports schemas from `domainSchemas.ts` and re-exports:
      - `z`, `registry`, `TicketRecordSchema`, `AgentOutputEnvelope*Schema`, `ErrorResponseSchema`, `PlanPayloadSchema`.

## Migration Steps

1. **Introduce shared schemas**
   - Created `src/models/domainSchemas.ts` with Zod equivalents of everything in `src/payloadTypes.ts` and `src/http/openapi.ts`.
   - Implemented recursive `PlanStepSchema` with `z.lazy`.
   - Defined envelope schemas and `TicketRecordSchema` reflecting the in-memory storage shape.

2. **Introduce shared types**
   - Created `src/models/domainTypes.ts`.
   - Added `z.infer`-based types for all domain concepts (roles, payloads, plan/QA structures, ticket).
   - Defined `AgentOutputEnvelopeBase` and generic `AgentOutputEnvelope<TPayload>`.

3. **Refactor HTTP/OpenAPI integration**
   - Added `src/http/openapiRegistry.ts` to own OpenAPI configuration and document generation.
   - Updated `src/http/app.ts` to import `generateOpenApiDocument` from `openapiRegistry.ts`.
   - Updated `src/http/routes.ts` to:
     - Import domain types from `../models/domainTypes.js`.
     - Import schemas and `z` from `./openapiRegistry.js` instead of the old `openapi.ts`.

4. **Refactor agents and storage**
   - Updated all agents in `src/agents/*.ts` to import types from `../models/domainTypes.js` instead of `../payloadTypes.js`.
   - Updated `src/storage.ts` to:
     - Import `AgentOutputEnvelope`, payload types, and `TicketRecord` from `./models/domainTypes.js`.
     - Rely on the shared `TicketRecord` type instead of a local interface.

5. **Remove legacy sources of truth**
   - Deleted `src/payloadTypes.ts`.
   - Deleted `src/http/openapi.ts`.

## Future Enhancements

- Validate agent JSON outputs at runtime by parsing them with the appropriate Zod envelope schema before storing them.
- Add tests that assert round-trip compatibility between agent outputs, Zod validation, and the HTTP API responses.

