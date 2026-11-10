import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { firestore } from "./config";
import type { ComponentAtlasUser } from "./auth";

const CHUNK_SIZE = 350_000;
const MAX_CLOUD_PAYLOAD_SIZE = 6_000_000;

export class CloudProjectTooLargeError extends Error {
  constructor() {
    super("This analysis exceeds the Component Atlas cloud sync limit.");
    this.name = "CloudProjectTooLargeError";
  }
}

export type CloudProject = {
  id: string;
  analyzedAt?: number;
  lastSyncedAt?: number;
  sourceKey: string;
  name: string;
  files: string[];
  sources: Record<string, string>;
  nodes: unknown[];
  edges: unknown[];
  details: Record<string, unknown>;
  issues?: unknown[];
  githubSourceBase: string;
  openFiles: string[];
  activeFile: string;
  selected: string;
  ignoredFiles: Array<{ path: string; reason: string }>;
  reportIncludedCount: number;
  reportLabel: string;
  sourceType?: "github" | "local" | "paste";
  favorite?: boolean;
  previousAnalysis?: { analyzedAt: number; fileCount?: number; nodeCount: number; edgeCount: number; issueCount: number; files?: string[]; nodes?: string[]; edges?: string[]; issues?: string[] };
};

function chunks(value: string) {
  const result: string[] = [];
  for (let index = 0; index < value.length; index += CHUNK_SIZE) result.push(value.slice(index, index + CHUNK_SIZE));
  return result.length ? result : [""];
}

function cloudSafeProject(project: CloudProject) {
  const details = Object.fromEntries(Object.entries(project.details).map(([key, rawDetail]) => {
    const detail = rawDetail && typeof rawDetail === "object" ? rawDetail as Record<string, unknown> : {};
    const insights = detail.insights && typeof detail.insights === "object" ? detail.insights as Record<string, unknown> : undefined;
    return [key, {
      ...detail,
      source: "",
      insights: insights ? { ...insights, diagnostics: Array.isArray(insights.diagnostics) ? insights.diagnostics.slice(0, 200) : [] } : undefined,
    }];
  }));
  return { ...project, sources: {}, details, ignoredFiles: project.ignoredFiles.slice(0, 1_000) };
}

export async function ensureCloudUser(user: ComponentAtlasUser) {
  await setDoc(doc(firestore, "users", user.userId), {
    displayName: user.displayName,
    email: user.email,
    photoURL: user.photoURL,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function saveCloudProject(userId: string, project: CloudProject) {
  const syncedAt = Date.now();
  project.lastSyncedAt = syncedAt;
  const projectRef = doc(firestore, "users", userId, "projects", project.id);
  const payload = JSON.stringify(cloudSafeProject(project));
  if (payload.length > MAX_CLOUD_PAYLOAD_SIZE) throw new CloudProjectTooLargeError();
  const payloadChunks = chunks(payload);
  const existingChunks = await getDocs(collection(projectRef, "payload"));
  const batch = writeBatch(firestore);
  existingChunks.docs.forEach((chunk) => batch.delete(chunk.ref));
  payloadChunks.forEach((value, index) => batch.set(doc(projectRef, "payload", String(index).padStart(5, "0")), { index, value }));
  batch.set(projectRef, {
    name: project.name,
    sourceKey: project.sourceKey,
    analyzedAt: project.analyzedAt ?? Date.now(),
    lastSyncedAt: syncedAt,
    fileCount: project.files.length,
    chunkCount: payloadChunks.length,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  await batch.commit();
  const verification = await getDoc(projectRef);
  if (!verification.exists()) throw new Error("Firestore write verification failed: the project document could not be read back.");
}

export async function loadCloudProjects(userId: string): Promise<CloudProject[]> {
  const projectsSnapshot = await getDocs(query(collection(firestore, "users", userId, "projects"), orderBy("analyzedAt", "asc")));
  const projects = await Promise.all(projectsSnapshot.docs.map(async (projectDocument) => {
    const payloadSnapshot = await getDocs(query(collection(projectDocument.ref, "payload"), orderBy("index", "asc")));
    const payload = payloadSnapshot.docs.map((chunk) => String(chunk.data().value ?? "")).join("");
    if (!payload) return null;
    try {
      return JSON.parse(payload) as CloudProject;
    } catch {
      return null;
    }
  }));
  return projects.filter((project): project is CloudProject => Boolean(project));
}

export async function deleteCloudProject(userId: string, projectId: string) {
  const projectRef = doc(firestore, "users", userId, "projects", projectId);
  const payloadSnapshot = await getDocs(collection(projectRef, "payload"));
  const batch = writeBatch(firestore);
  payloadSnapshot.docs.forEach((chunk) => batch.delete(chunk.ref));
  batch.delete(projectRef);
  await batch.commit();
}
