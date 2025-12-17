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
  projects: ProjectRecord[];
  projectsById: Record<string, ProjectRecord>;
  loading: boolean;
  error?: string;
  loadProjects: () => Promise<void>;
  loadProject: (projectId: string) => Promise<ProjectRecord | undefined>;
  upsertProject: (
    projectId: string,
    patch: { name?: string; workingDirectory?: string },
  ) => Promise<ProjectRecord>;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  projectsById: {},
  loading: false,
  error: undefined,
  async loadProjects() {
    set({ loading: true, error: undefined });
    try {
      const data = await apiJson<{ projects: ProjectRecord[] }>("/api/projects");
      set({
        projects: data.projects,
        projectsById: data.projects.reduce<Record<string, ProjectRecord>>(
          (acc, project) => {
            acc[project.projectId] = project;
            return acc;
          },
          {},
        ),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      set({ error: message });
    } finally {
      set({ loading: false });
    }
  },
  async loadProject(projectId) {
    set({ loading: true, error: undefined });
    try {
      const data = await apiJson<{ project: ProjectRecord }>(
        `/api/projects/${encodeURIComponent(projectId)}`,
      );
      set((state) => ({
        projectsById: { ...state.projectsById, [projectId]: data.project },
        projects: [
          data.project,
          ...state.projects.filter((project) => project.projectId !== projectId),
        ],
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
        projects: [
          data.project,
          ...state.projects.filter((project) => project.projectId !== projectId),
        ],
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
