import { create } from "zustand";

export type Theme = "dark" | "light";
export type FileTab =
  | "Files"
  | "Components"
  | "Routes"
  | "Hooks"
  | "Styles"
  | "Assets";
export type InspectorTab = "Overview" | "Relations" | "Source";
export type WorkspaceMenu =
  | "project"
  | "projectSearch"
  | "filter"
  | "fileView"
  | "more"
  | "workspaceTools"
  | "codeActions"
  | "account"
  | null;
export type WorkspaceModal =
  | "import"
  | "paste"
  | "github"
  | "settings"
  | "report"
  | "diagnostics"
  | "comparison"
  | "unsupported"
  | "duplicate"
  | "remove"
  | "rename"
  | "shortcuts"
  | "analysis"
  | null;

type StateUpdate<T> = T | ((current: T) => T);

const resolveUpdate = <T>(current: T, update: StateUpdate<T>) =>
  typeof update === "function"
    ? (update as (value: T) => T)(current)
    : update;

type WorkspaceUiState = {
  theme: Theme;
  menu: WorkspaceMenu;
  modal: WorkspaceModal;
  explorerWidth: number;
  inspectorWidth: number;
  codeHeight: number;
  explorerCollapsed: boolean;
  inspectorCollapsed: boolean;
  fileTab: FileTab;
  inspectorTab: InspectorTab;
  showMinimap: boolean;
  showGraphLegend: boolean;
  showOnboarding: boolean;
  toast: string;
  setTheme: (update: StateUpdate<Theme>) => void;
  setMenu: (update: StateUpdate<WorkspaceMenu>) => void;
  setModal: (update: StateUpdate<WorkspaceModal>) => void;
  setExplorerWidth: (update: StateUpdate<number>) => void;
  setInspectorWidth: (update: StateUpdate<number>) => void;
  setCodeHeight: (update: StateUpdate<number>) => void;
  setExplorerCollapsed: (update: StateUpdate<boolean>) => void;
  setInspectorCollapsed: (update: StateUpdate<boolean>) => void;
  setFileTab: (update: StateUpdate<FileTab>) => void;
  setInspectorTab: (update: StateUpdate<InspectorTab>) => void;
  setShowMinimap: (update: StateUpdate<boolean>) => void;
  setShowGraphLegend: (update: StateUpdate<boolean>) => void;
  setShowOnboarding: (update: StateUpdate<boolean>) => void;
  setToast: (update: StateUpdate<string>) => void;
  resetTransientUi: () => void;
};

export const useWorkspaceUiStore = create<WorkspaceUiState>((set) => ({
  theme: "dark",
  menu: null,
  modal: null,
  explorerWidth: 300,
  inspectorWidth: 390,
  codeHeight: 280,
  explorerCollapsed: false,
  inspectorCollapsed: false,
  fileTab: "Files",
  inspectorTab: "Overview",
  showMinimap: true,
  showGraphLegend: true,
  showOnboarding: false,
  toast: "",
  setTheme: (update) => set((state) => ({ theme: resolveUpdate(state.theme, update) })),
  setMenu: (update) => set((state) => ({ menu: resolveUpdate(state.menu, update) })),
  setModal: (update) => set((state) => ({ modal: resolveUpdate(state.modal, update) })),
  setExplorerWidth: (update) => set((state) => ({ explorerWidth: resolveUpdate(state.explorerWidth, update) })),
  setInspectorWidth: (update) => set((state) => ({ inspectorWidth: resolveUpdate(state.inspectorWidth, update) })),
  setCodeHeight: (update) => set((state) => ({ codeHeight: resolveUpdate(state.codeHeight, update) })),
  setExplorerCollapsed: (update) => set((state) => ({ explorerCollapsed: resolveUpdate(state.explorerCollapsed, update) })),
  setInspectorCollapsed: (update) => set((state) => ({ inspectorCollapsed: resolveUpdate(state.inspectorCollapsed, update) })),
  setFileTab: (update) => set((state) => ({ fileTab: resolveUpdate(state.fileTab, update) })),
  setInspectorTab: (update) => set((state) => ({ inspectorTab: resolveUpdate(state.inspectorTab, update) })),
  setShowMinimap: (update) => set((state) => ({ showMinimap: resolveUpdate(state.showMinimap, update) })),
  setShowGraphLegend: (update) => set((state) => ({ showGraphLegend: resolveUpdate(state.showGraphLegend, update) })),
  setShowOnboarding: (update) => set((state) => ({ showOnboarding: resolveUpdate(state.showOnboarding, update) })),
  setToast: (update) => set((state) => ({ toast: resolveUpdate(state.toast, update) })),
  resetTransientUi: () => set({ menu: null, modal: null, toast: "" }),
}));
