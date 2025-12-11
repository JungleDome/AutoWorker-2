export interface AgentOutputEnvelope<TPayload = unknown> {
  ticket_id: string;
  agent: string;
  payload: TPayload;
  created_at?: string;
}

export interface TicketRecord {
  ticketId: string;
  createdAt: string;
  updatedAt: string;
  latestRequirements?: AgentOutputEnvelope;
  latestPlan?: AgentOutputEnvelope;
  planHistory: AgentOutputEnvelope[];
  executionResults: AgentOutputEnvelope[];
  qaReports: AgentOutputEnvelope[];
  feedback: {
    requirements: string[];
    plan: string[];
    execution: string[];
    qa: string[];
  };
}

export interface RequirementsRequest {
  raw_description: string;
  notes_for_agent?: string;
}

export interface PlanRequest {
  notes_for_agent?: string;
}

export interface ExecutionRequest {
  plan_id?: string;
  step_ids?: string[];
  notes_for_agent?: string;
}

export interface QaRequest {
  plan_id?: string;
  notes_for_agent?: string;
}
