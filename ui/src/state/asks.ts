import { create } from "zustand";

export interface AskRecord {
  schemaVersion: number;
  askId: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  question: string;
  answer: string | null;
  relatedTicketIds: string[];
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

interface AskState {
  asksByProject: Record<string, AskRecord[]>;
  loading: boolean;
  error?: string;
  loadAsks: (projectId: string) => Promise<void>;
  createAsk: (projectId: string, question: string) => Promise<AskRecord>;
}

export const useAskStore = create<AskState>((set) => ({
  asksByProject: {},
  loading: false,
  error: undefined,
  async loadAsks(projectId) {
    set({ loading: true, error: undefined });
    try {
      const data = await apiJson<{ asks: AskRecord[] }>(
        `/api/projects/${encodeURIComponent(projectId)}/asks`,
      );
      set((state) => ({
        asksByProject: { ...state.asksByProject, [projectId]: data.asks },
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      set({ error: message });
    } finally {
      set({ loading: false });
    }
  },
  async createAsk(projectId, question) {
    set({ loading: true, error: undefined });
    try {
      const data = await apiJson<{ ask: AskRecord }>(
        `/api/projects/${encodeURIComponent(projectId)}/asks`,
        {
          method: "POST",
          body: JSON.stringify({ question }),
        },
      );
      set((state) => ({
        asksByProject: {
          ...state.asksByProject,
          [projectId]: [
            data.ask,
            ...(state.asksByProject[projectId] ?? []).filter(
              (ask) => ask.askId !== data.ask.askId,
            ),
          ],
        },
      }));
      return data.ask;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      set({ error: message });
      throw new Error(message);
    } finally {
      set({ loading: false });
    }
  },
}));

