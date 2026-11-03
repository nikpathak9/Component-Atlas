import { create } from "zustand";

type StateUpdate<T> = T | ((current: T) => T);

const resolveUpdate = <T>(current: T, update: StateUpdate<T>) =>
  typeof update === "function"
    ? (update as (value: T) => T)(current)
    : update;

export type HighlightedLocation = {
  file: string;
  line: number;
  endLine: number;
} | null;

type EditorState = {
  activeFile: string;
  openFiles: string[];
  fileQuery: string;
  projectQuery: string;
  nodeQuery: string;
  expandedFolders: Set<string>;
  highlightedLocation: HighlightedLocation;
  activeStep: number;
  setActiveFile: (update: StateUpdate<string>) => void;
  setOpenFiles: (update: StateUpdate<string[]>) => void;
  setFileQuery: (update: StateUpdate<string>) => void;
  setProjectQuery: (update: StateUpdate<string>) => void;
  setNodeQuery: (update: StateUpdate<string>) => void;
  setExpandedFolders: (update: StateUpdate<Set<string>>) => void;
  setHighlightedLocation: (update: StateUpdate<HighlightedLocation>) => void;
  setActiveStep: (update: StateUpdate<number>) => void;
  resetEditor: () => void;
};

export const useEditorStore = create<EditorState>((set) => ({
  activeFile: "",
  openFiles: [],
  fileQuery: "",
  projectQuery: "",
  nodeQuery: "",
  expandedFolders: new Set<string>(),
  highlightedLocation: null,
  activeStep: 0,
  setActiveFile: (update) => set((state) => ({ activeFile: resolveUpdate(state.activeFile, update) })),
  setOpenFiles: (update) => set((state) => ({ openFiles: resolveUpdate(state.openFiles, update) })),
  setFileQuery: (update) => set((state) => ({ fileQuery: resolveUpdate(state.fileQuery, update) })),
  setProjectQuery: (update) => set((state) => ({ projectQuery: resolveUpdate(state.projectQuery, update) })),
  setNodeQuery: (update) => set((state) => ({ nodeQuery: resolveUpdate(state.nodeQuery, update) })),
  setExpandedFolders: (update) => set((state) => ({ expandedFolders: resolveUpdate(state.expandedFolders, update) })),
  setHighlightedLocation: (update) => set((state) => ({ highlightedLocation: resolveUpdate(state.highlightedLocation, update) })),
  setActiveStep: (update) => set((state) => ({ activeStep: resolveUpdate(state.activeStep, update) })),
  resetEditor: () => set({
    activeFile: "",
    openFiles: [],
    fileQuery: "",
    projectQuery: "",
    nodeQuery: "",
    expandedFolders: new Set<string>(),
    highlightedLocation: null,
    activeStep: 0,
  }),
}));
