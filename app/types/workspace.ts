export type NodeKind = "Page" | "Component" | "Hook" | "Service" | "Utility";

export type AnalysisIssue = {
  title: string;
  file: string;
  line: number;
  column?: number;
  detail: string;
  source?: "parser" | "ast" | "typescript" | "eslint";
  severity?: "error" | "warning" | "info";
  ruleId?: string;
};

export type NodeDetail = {
  name?: string;
  file: string;
  type: NodeKind;
  parent: string;
  children: string;
  metrics: string[];
  steps: string[];
  explanations?: Array<{
    text: string;
    line: number;
    endLine?: number;
    kind: string;
  }>;
  source: string;
  relations?: { usedBy: string[]; dependsOn: string[]; resources?: string[] };
  insights?: {
    props: string[];
    hooks: string[];
    exports: string[];
    diagnostics: AnalysisIssue[];
    bundler?: string[];
    framework?: string[];
  };
};

export type GraphNode = {
  id: string;
  name: string;
  file: string;
  kind: NodeKind;
  icon: string;
  tone: string;
  meta: string;
};

export type GraphEdge = {
  from: string;
  to: string;
  dashed?: boolean;
  kind?: "import" | "render" | "data" | "callback" | "api" | "route";
  label?: string;
  line?: number;
};

export type IgnoredFile = { path: string; reason: string };

export type ProjectWorkspace = {
  id: string;
  analyzedAt?: number;
  lastSyncedAt?: number;
  sourceKey: string;
  name: string;
  files: string[];
  sources: Record<string, string>;
  nodes: GraphNode[];
  edges: GraphEdge[];
  details: Record<string, NodeDetail>;
  githubSourceBase: string;
  openFiles: string[];
  activeFile: string;
  selected: string;
  ignoredFiles: IgnoredFile[];
  reportIncludedCount: number;
  reportLabel: string;
  sourceType?: "github" | "local" | "paste";
  favorite?: boolean;
  previousAnalysis?: {
    analyzedAt: number;
    fileCount?: number;
    nodeCount: number;
    edgeCount: number;
    issueCount: number;
    files?: string[];
    nodes?: string[];
    edges?: string[];
    issues?: string[];
  };
};

export type SyncState = {
  status: "local" | "syncing" | "synced" | "error" | "local-only";
  lastSyncedAt?: number;
};

export type AnalysisStatus = "progress" | "complete" | "issues" | "setup" | "error";

export type AnalysisProgress = {
  status: AnalysisStatus;
  stage: number;
  name: string;
  totalFiles: number;
  processedFiles: number;
  cachedFiles: number;
  components: number;
  imports: number;
  error: string;
};

export type AnalyzerProgressUpdate = {
  stage: 1 | 2 | 3 | 4;
  components?: number;
  imports?: number;
  processedFiles?: number;
  totalFiles?: number;
  cachedFiles?: number;
};

export type AuthUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
  photoURL?: string | null;
};

export type StoredWorkspaceSession = {
  ownerId?: string;
  projects: ProjectWorkspace[];
  activeProjectId: string;
  showWorkspace: boolean;
  showReport?: boolean;
  theme: "dark" | "light";
};
