import { AgentOutputEnvelope, ExecutionResultPayload, PlanPayload, QaReportPayload, RequirementsPayload } from "@/models/domainTypes";
import { create } from "zustand";

export interface TicketRecord {
  ticketId: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  latestRequirements?: AgentOutputEnvelope<RequirementsPayload>;
  latestPlan?: AgentOutputEnvelope<PlanPayload>;
  planHistory: AgentOutputEnvelope<PlanPayload>[];
  executionResults: AgentOutputEnvelope<ExecutionResultPayload>[];
  qaReports: AgentOutputEnvelope<QaReportPayload>[];
  feedback: {
    requirements: string[];
    plan: string[];
    execution: string[];
    qa: string[];
  };
}


const API_BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/$/, "");

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
    },
    ...init,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

interface TicketState {
  tickets: TicketRecord[];
  selectedTicket?: TicketRecord;
  loading: boolean;
  error?: string;
  loadTickets: () => Promise<void>;
  selectTicket: (ticketId: string) => Promise<void>;
  createTicket: (ticketId: string) => Promise<void>;
  runRequirements: (
    ticketId: string,
    payload: { description: string; notes?: string },
  ) => Promise<void>;
}

export const useTicketStore = create<TicketState>((set, get) => ({
  tickets: [],
  selectedTicket: undefined,
  loading: false,
  error: undefined,
  async loadTickets() {
    set({ loading: true, error: undefined });
    try {
      const data = await apiJson<{ tickets: TicketRecord[] }>("/api/tickets");
      set({ tickets: data.tickets });
      const current = get().selectedTicket;
      if (current) {
        const refreshed = data.tickets.find(
          (ticket) => ticket.ticketId === current.ticketId,
        );
        set({ selectedTicket: refreshed ?? current });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      set({ error: message });
    } finally {
      set({ loading: false });
    }
  },
  async selectTicket(ticketId) {
    set({ loading: true, error: undefined });
    try {
      const data = await apiJson<{ ticket: TicketRecord }>(
        `/api/tickets/${encodeURIComponent(ticketId)}`,
      );
      set({ selectedTicket: data.ticket });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      set({ error: message });
    } finally {
      set({ loading: false });
    }
  },
  async createTicket(ticketId) {
    set({ loading: true, error: undefined });
    try {
      const data = await apiJson<{ ticket: TicketRecord }>(
        `/api/tickets/${encodeURIComponent(ticketId)}`,
        { method: "POST" },
      );
      set((state) => ({
        tickets: [data.ticket, ...state.tickets.filter((t) => t.ticketId !== ticketId)],
        selectedTicket: data.ticket,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      set({ error: message });
    } finally {
      set({ loading: false });
    }
  },
  async runRequirements(ticketId, payload) {
    set({ loading: true, error: undefined });
    try {
      const data = await apiJson<{ ticket: TicketRecord }>(
        `/api/tickets/${encodeURIComponent(ticketId)}/requirements`,
        {
          method: "POST",
          body: JSON.stringify({
            raw_description: payload.description,
            notes_for_agent: payload.notes,
          }),
        },
      );
      set((state) => ({
        tickets: state.tickets.map((ticket) =>
          ticket.ticketId === ticketId ? data.ticket : ticket,
        ),
        selectedTicket:
          state.selectedTicket?.ticketId === ticketId
            ? data.ticket
            : state.selectedTicket,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      set({ error: message });
    } finally {
      set({ loading: false });
    }
  },
}));
