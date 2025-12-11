import { create } from "zustand";

import { createTicket, fetchTicket, fetchTickets, runExecution, runPlan, runQa, runRequirements } from "../lib/api";
import type { ExecutionRequest, PlanRequest, QaRequest, RequirementsRequest, TicketRecord } from "../types";

interface TicketState {
  baseUrl: string;
  tickets: TicketRecord[];
  selectedTicketId?: string;
  loading: boolean;
  error?: string;
  refreshingTicketId?: string;
  setBaseUrl: (value: string) => void;
  selectTicket: (ticketId?: string) => void;
  loadTickets: () => Promise<void>;
  ensureTicket: (ticketId: string) => Promise<TicketRecord | undefined>;
  refreshTicket: (ticketId: string) => Promise<void>;
  runRequirements: (ticketId: string, payload: RequirementsRequest) => Promise<void>;
  runPlan: (ticketId: string, payload: PlanRequest) => Promise<void>;
  runExecution: (ticketId: string, payload: ExecutionRequest) => Promise<void>;
  runQa: (ticketId: string, payload: QaRequest) => Promise<void>;
}

function mergeTicket(list: TicketRecord[], ticket: TicketRecord) {
  const existingIndex = list.findIndex((t) => t.ticketId === ticket.ticketId);
  if (existingIndex >= 0) {
    const clone = [...list];
    clone[existingIndex] = ticket;
    return clone;
  }
  return [...list, ticket];
}

export const useTicketsStore = create<TicketState>((set, get) => ({
  baseUrl: (typeof window !== "undefined" && import.meta.env.VITE_API_BASE) || "http://localhost:3000",
  tickets: [],
  loading: false,
  error: undefined,
  refreshingTicketId: undefined,
  setBaseUrl: (value) => set({ baseUrl: value }),
  selectTicket: (ticketId) => set({ selectedTicketId: ticketId }),
  loadTickets: async () => {
    set({ loading: true, error: undefined });
    try {
      const tickets = await fetchTickets(get().baseUrl);
      set((state) => ({
        tickets,
        loading: false,
        selectedTicketId: state.selectedTicketId ?? tickets[0]?.ticketId,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load tickets";
      set({ error: message, loading: false });
    }
  },
  ensureTicket: async (ticketId) => {
    try {
      const ticket = await createTicket(get().baseUrl, ticketId);
      set((state) => ({
        tickets: mergeTicket(state.tickets, ticket),
        selectedTicketId: ticket.ticketId,
      }));
      return ticket;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create ticket";
      set({ error: message });
      return undefined;
    }
  },
  refreshTicket: async (ticketId) => {
    set({ refreshingTicketId: ticketId, error: undefined });
    try {
      const ticket = await fetchTicket(get().baseUrl, ticketId);
      set((state) => ({
        tickets: mergeTicket(state.tickets, ticket),
        refreshingTicketId: undefined,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to refresh ticket";
      set({ error: message, refreshingTicketId: undefined });
    }
  },
  runRequirements: async (ticketId, payload) => {
    await runRequirements(get().baseUrl, ticketId, payload);
    await get().refreshTicket(ticketId);
  },
  runPlan: async (ticketId, payload) => {
    await runPlan(get().baseUrl, ticketId, payload);
    await get().refreshTicket(ticketId);
  },
  runExecution: async (ticketId, payload) => {
    await runExecution(get().baseUrl, ticketId, payload);
    await get().refreshTicket(ticketId);
  },
  runQa: async (ticketId, payload) => {
    await runQa(get().baseUrl, ticketId, payload);
    await get().refreshTicket(ticketId);
  },
}));
