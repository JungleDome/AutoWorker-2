import { create } from "zustand";

export interface ProjectRecord {
  projectId: string;
  name: string;
  workingDirectory: string;
  createdAt: string;
  updatedAt: string;
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

interface ProjectState {
  projectsById: Record<string, ProjectRecord>;
  loading: boolean;
  error?: string;
  loadProject: (projectId: string) => Promise<ProjectRecord | undefined>;
  upsertProject: (
    projectId: string,
    patch: { name?: string; workingDirectory?: string },
  ) => Promise<ProjectRecord>;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projectsById: {},
  loading: false,
  error: undefined,
  async loadProject(projectId) {
    set({ loading: true, error: undefined });
    try {
      const data = await apiJson<{ project: ProjectRecord }>(
        `/api/projects/${encodeURIComponent(projectId)}`,
      );
      set((state) => ({
        projectsById: { ...state.projectsById, [projectId]: data.project },
      }));
      return data.project;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      set({ error: message });
      return undefined;
    } finally {
      set({ loading: false });
    }
  },
  async upsertProject(projectId, patch) {
    set({ loading: true, error: undefined });
    try {
      const data = await apiJson<{ project: ProjectRecord }>(
        `/api/projects/${encodeURIComponent(projectId)}`,
        {
          method: "POST",
          body: JSON.stringify(patch),
        },
      );
      set((state) => ({
        projectsById: { ...state.projectsById, [projectId]: data.project },
      }));
      return data.project;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      set({ error: message });
      throw new Error(message);
    } finally {
      set({ loading: false });
    }
  },
}));

