/// <reference types="vite/client" />

import AnalyzerWorker from "./worker?worker";
import type { AnalysisResult, AnalyzerProgress } from "./index";

type AnalysisResponse = { id: number; result?: AnalysisResult; error?: string; progress?: AnalyzerProgress };
type PendingAnalysis = { resolve: (result: AnalysisResult) => void; reject: (error: Error) => void; onProgress?: (progress: AnalyzerProgress) => void };

let analyzerWorker: Worker | null = null;
let nextRequestId = 1;
const pendingAnalyses = new Map<number, PendingAnalysis>();

function rejectPendingAnalyses(message: string) {
  pendingAnalyses.forEach(({ reject }) => reject(new Error(message)));
  pendingAnalyses.clear();
}

function getAnalyzerWorker() {
  if (typeof Worker === "undefined") return null;
  if (analyzerWorker) return analyzerWorker;
  try {
    analyzerWorker = new AnalyzerWorker({ name: "component-atlas-analyzer" });
  } catch {
    analyzerWorker = null;
    return null;
  }
  analyzerWorker.onmessage = ({ data }: MessageEvent<AnalysisResponse>) => {
    const pending = pendingAnalyses.get(data.id);
    if (!pending) return;
    if (data.progress) {
      pending.onProgress?.(data.progress);
      return;
    }
    pendingAnalyses.delete(data.id);
    if (data.result) pending.resolve(data.result);
    else pending.reject(new Error(data.error || "Source analysis failed"));
  };
  analyzerWorker.onerror = () => {
    rejectPendingAnalyses("The source analyzer stopped unexpectedly");
    analyzerWorker?.terminate();
    analyzerWorker = null;
  };
  analyzerWorker.onmessageerror = () => {
    rejectPendingAnalyses("The source analyzer returned an unreadable result");
  };
  return analyzerWorker;
}

export async function analyzeProjectSources(sources: Record<string, string>, onProgress?: (progress: AnalyzerProgress) => void) {
  const worker = getAnalyzerWorker();
  if (!worker) return (await import("./index")).analyzeProjectSources(sources, onProgress);
  const id = nextRequestId++;
  try {
    return await new Promise<AnalysisResult>((resolve, reject) => {
      pendingAnalyses.set(id, { resolve, reject, onProgress });
      try {
        worker.postMessage({ id, sources });
      } catch (error) {
        pendingAnalyses.delete(id);
        reject(error instanceof Error ? error : new Error("The source analyzer could not start"));
      }
    });
  } catch {
    return (await import("./index")).analyzeProjectSources(sources, onProgress);
  }
}
