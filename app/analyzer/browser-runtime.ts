type BrowserProcess = {
  browser: true;
  env: Record<string, string | undefined>;
  argv: string[];
  execArgv: string[];
  platform: "browser";
  pid: number;
  cwd: () => string;
  nextTick: (callback: (...args: unknown[]) => void, ...args: unknown[]) => void;
  emitWarning: () => void;
  memoryUsage: () => { heapUsed: number };
  stdout: { columns: number; isTTY: false; write: () => void };
};

/**
 * Some browser-compatible analyzer dependencies still probe Node's `process`
 * global during module initialization. Install the smallest safe browser shim
 * before those modules are imported. Never replace a real Node process.
 */
export function ensureAnalyzerBrowserRuntime() {
  const runtime = globalThis as typeof globalThis & { process?: BrowserProcess };
  if (runtime.process) return;

  const processShim: BrowserProcess = {
    browser: true,
    env: {},
    argv: [],
    execArgv: [],
    platform: "browser",
    pid: 0,
    cwd: () => "/",
    nextTick: (callback, ...args) => queueMicrotask(() => callback(...args)),
    emitWarning: () => undefined,
    memoryUsage: () => ({ heapUsed: 0 }),
    stdout: {
      columns: 80,
      isTTY: false,
      write: () => undefined,
    },
  };

  Object.defineProperty(runtime, "process", {
    configurable: true,
    enumerable: false,
    value: processShim,
    writable: false,
  });
}
