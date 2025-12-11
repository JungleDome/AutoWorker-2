import type {
  ExecutionRequest,
  PlanRequest,
  QaRequest,
  RequirementsRequest,
  TicketRecord,
} from "../types";

async function request<T>(baseUrl: string, path: string, init?: RequestInit) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || response.statusText);
  }

  return (await response.json()) as T;
}

export async function fetchTickets(baseUrl: string) {
  const data = await request<{ tickets: TicketRecord[] }>(baseUrl, "/api/tickets");
  return data.tickets;
}

export async function fetchTicket(baseUrl: string, ticketId: string) {
  const data = await request<{ ticket: TicketRecord }>(
    baseUrl,
    `/api/tickets/${ticketId}`,
  );
  return data.ticket;
}

export async function createTicket(baseUrl: string, ticketId: string) {
  const data = await request<{ ticket: TicketRecord }>(baseUrl, `/api/tickets/${ticketId}`, {
    method: "POST",
  });
  return data.ticket;
}

export async function runRequirements(
  baseUrl: string,
  ticketId: string,
  payload: RequirementsRequest,
) {
  const data = await request<{ requirements: unknown }>(
    baseUrl,
    `/api/tickets/${ticketId}/requirements`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
  return data.requirements;
}

export async function runPlan(baseUrl: string, ticketId: string, payload: PlanRequest) {
  const data = await request<{ plan: unknown }>(
    baseUrl,
    `/api/tickets/${ticketId}/plan`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
  return data.plan;
}

export async function runExecution(
  baseUrl: string,
  ticketId: string,
  payload: ExecutionRequest,
) {
  const data = await request<{ execution: unknown }>(
    baseUrl,
    `/api/tickets/${ticketId}/execute`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
  return data.execution;
}

export async function runQa(baseUrl: string, ticketId: string, payload: QaRequest) {
  const data = await request<{ qa_report: unknown }>(
    baseUrl,
    `/api/tickets/${ticketId}/qa`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
  return data.qa_report;
}
