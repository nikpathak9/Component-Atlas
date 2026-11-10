import type { AnalysisResult, AnalyzerProgress } from "./index";
import { ensureAnalyzerBrowserRuntime } from "./browser-runtime";

type AnalysisRequest = { id: number; sources: Record<string, string> };
type AnalysisResponse = { id: number; result?: AnalysisResult; error?: string; progress?: AnalyzerProgress };

const workerScope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<AnalysisRequest>) => void) | null;
  postMessage: (message: AnalysisResponse) => void;
};

workerScope.onmessage = async ({ data }) => {
  try {
    ensureAnalyzerBrowserRuntime();
    const { analyzeProjectSources } = await import("./index");
    workerScope.postMessage({ id: data.id, result: await analyzeProjectSources(data.sources, (progress) => workerScope.postMessage({ id: data.id, progress })) });
  } catch (error) {
    workerScope.postMessage({ id: data.id, error: error instanceof Error ? error.message : "Source analysis failed" });
  }
};
