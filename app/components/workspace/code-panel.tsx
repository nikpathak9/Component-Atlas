/* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */
import { memo, useEffect, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import ChevronRight from "lucide-react/icons/chevron-right";
import CloudOff from "lucide-react/icons/cloud-off";
import Code2 from "lucide-react/icons/code-2";
import Copy from "lucide-react/icons/copy";
import Ellipsis from "lucide-react/icons/ellipsis";
import FileCode2 from "lucide-react/icons/file-code-2";
import FolderOpen from "lucide-react/icons/folder-open";
import X from "lucide-react/icons/x";
import { useShallow } from "zustand/react/shallow";
import { HighlightedCode } from "../code/highlighted-code";
import { BINARY_ASSET_PATTERN, IMAGE_FILE_PATTERN, fileCategory, fileIcon, sourceExtension } from "../../lib/file-types";
import { useEditorStore } from "../../stores/editor-store";
import { useWorkspaceUiStore } from "../../stores/ui-store";
import type { NodeDetail, ProjectWorkspace } from "../../types/workspace";

const lineRangeLabel = (line: number, endLine = line) =>
  endLine > line ? `Lines ${line}–${endLine}` : `Line ${line}`;

type CodePanelProps = {
  fileSources: Record<string, string>;
  projectDetails: Record<string, NodeDetail>;
  activeProject: ProjectWorkspace | null;
  activeSourceType: "github" | "local" | "paste" | null;
  canvasColumnRef: RefObject<HTMLElement | null>;
  onOpenFile: (file: string) => void | Promise<void>;
  onResizeStart: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPasteAgain: () => void;
  onReconnectProject: (project: ProjectWorkspace) => void;
  notify: (message: string) => void;
};

export const CodePanel = memo(function CodePanel({
  fileSources,
  projectDetails,
  activeProject,
  activeSourceType,
  canvasColumnRef,
  onOpenFile,
  onResizeStart,
  onPasteAgain,
  onReconnectProject,
  notify,
}: CodePanelProps) {
  const tabsRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLPreElement>(null);
  const {
    activeFile,
    setActiveFile,
    openFiles,
    setOpenFiles,
    highlightedLocation,
  } = useEditorStore(
    useShallow((state) => ({
      activeFile: state.activeFile,
      setActiveFile: state.setActiveFile,
      openFiles: state.openFiles,
      setOpenFiles: state.setOpenFiles,
      highlightedLocation: state.highlightedLocation,
    })),
  );
  const { codeHeight, setCodeHeight, menu, setMenu } = useWorkspaceUiStore(
    useShallow((state) => ({
      codeHeight: state.codeHeight,
      setCodeHeight: state.setCodeHeight,
      menu: state.menu,
      setMenu: state.setMenu,
    })),
  );

  const activeSource = activeFile
    ? (fileSources[activeFile] ?? "// Source is not available for this file.")
    : "";
  const activeSourceMissing = Boolean(
    activeProject && activeFile && !fileSources[activeFile] && activeSourceType !== "github",
  );
  const activeIsImage = Boolean(activeFile && IMAGE_FILE_PATTERN.test(activeFile));
  const activeIsBinaryAsset = Boolean(activeFile && BINARY_ASSET_PATTERN.test(activeFile));

  useEffect(() => {
    const activeTab = Array.from(
      tabsRef.current?.querySelectorAll<HTMLElement>("[data-code-file]") ?? [],
    ).find((tab) => tab.dataset.codeFile === activeFile);
    activeTab?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [activeFile, openFiles]);

  useEffect(() => {
    if (!highlightedLocation || highlightedLocation.file !== activeFile) return;
    const frame = window.requestAnimationFrame(() => {
      previewRef.current
        ?.querySelector<HTMLElement>(`[data-line="${highlightedLocation.line}"]`)
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeFile, activeSource, highlightedLocation]);

  const closeFile = (file: string) => {
    const closingIndex = openFiles.indexOf(file);
    const remaining = openFiles.filter((openFile) => openFile !== file);
    setOpenFiles(remaining);
    if (activeFile === file)
      setActiveFile(remaining[Math.min(closingIndex, remaining.length - 1)] ?? "");
  };

  return (
    <div className='code-preview'>
      <div
        className='resize-handle resize-top'
        role='separator'
        tabIndex={0}
        aria-label='Resize code panel'
        aria-orientation='horizontal'
        aria-valuemin={180}
        aria-valuenow={codeHeight}
        onKeyDown={(event) => {
          if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
          event.preventDefault();
          const columnHeight = canvasColumnRef.current?.clientHeight ?? window.innerHeight - 50;
          const maximum = Math.floor(Math.max(360, columnHeight - 56) * 0.8);
          setCodeHeight((current) => Math.min(maximum, Math.max(180, current + (event.key === "ArrowUp" ? 10 : -10))));
        }}
        onPointerDown={onResizeStart}
      />
      <div className='code-tabs'>
        <button className='code-tabs-scroll scroll-left' aria-label='Scroll tabs left' title='Scroll tabs left' onClick={() => tabsRef.current?.scrollBy({ left: -260, behavior: "smooth" })}><ChevronRight aria-hidden='true' /></button>
        <div
          className='code-tab-strip'
          ref={tabsRef}
          role='tablist'
          tabIndex={0}
          aria-label='Open project files'
          onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("[role=tab]"));
            const current = tabs.indexOf(document.activeElement as HTMLButtonElement);
            if (current < 0 || !tabs.length) return;
            event.preventDefault();
            const next = (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
            tabs[next]?.focus();
            tabs[next]?.click();
          }}
        >
          {openFiles.map((file) => {
            const issueCount = projectDetails[file]?.insights?.diagnostics?.length ?? 0;
            return (
              <div className={`code-tab ${activeFile === file ? "active" : ""}`} data-code-file={file} key={file}>
                <button className='code-tab-select' role='tab' aria-selected={activeFile === file} title={file} onClick={() => void onOpenFile(file)}>
                  {fileIcon(file)} <span>{file.split("/").at(-1)}</span>
                  {issueCount > 0 ? <i className='code-tab-issues' title={`${issueCount} analysis issue${issueCount === 1 ? "" : "s"}`}>{issueCount}</i> : activeFile === file ? <i>●</i> : null}
                </button>
                <button className='code-tab-close' aria-label={`Close ${file.split("/").at(-1)}`} title='Close tab' onClick={() => closeFile(file)}><X aria-hidden='true' /></button>
              </div>
            );
          })}
        </div>
        <button className='code-tabs-scroll' aria-label='Scroll tabs right' title='Scroll tabs right' onClick={() => tabsRef.current?.scrollBy({ left: 260, behavior: "smooth" })}><ChevronRight aria-hidden='true' /></button>
      </div>
      {activeFile && (
        <div className='code-source-bar'>
          <div>
            {fileIcon(activeFile)}<span title={activeFile}>{activeFile}</span>
            {highlightedLocation?.file === activeFile && <em>{lineRangeLabel(highlightedLocation.line, highlightedLocation.endLine)}</em>}
            {(projectDetails[activeFile]?.insights?.diagnostics?.length ?? 0) > 0 && <i>{projectDetails[activeFile]?.insights?.diagnostics?.length} issues</i>}
          </div>
          <div className='code-source-actions'>
            <button aria-label='Copy file path' title='Copy file path' onClick={() => { void navigator.clipboard?.writeText(activeFile); notify("File path copied"); }}><Copy aria-hidden='true' /><span>Path</span></button>
            <button aria-label='More code actions' aria-expanded={menu === "codeActions"} title='More code actions' onClick={() => setMenu(menu === "codeActions" ? null : "codeActions")}><Ellipsis aria-hidden='true' /></button>
            {menu === "codeActions" && <div className='popover code-actions-menu' role='menu'><button role='menuitem' onClick={() => { void navigator.clipboard?.writeText(activeSource); notify("Code copied"); setMenu(null); }}><Copy aria-hidden='true' /> Copy code</button><button role='menuitem' onClick={() => { setOpenFiles([activeFile]); setMenu(null); }}><X aria-hidden='true' /> Close other tabs</button></div>}
          </div>
        </div>
      )}
      {!activeFile ? (
        <div className='code-empty-state'><FileCode2 aria-hidden='true' /><b>No file open</b><p>Select a file in the Project Explorer to inspect its source.</p></div>
      ) : activeSourceMissing ? (
        <div className='missing-source-state'><CloudOff aria-hidden='true' /><div><b>{activeSourceType === "paste" ? "Pasted source is unavailable on this device" : "Source files are unavailable on this device"}</b><p>The graph and analysis were restored securely from the cloud, but Component Atlas does not upload private source code.</p><button onClick={() => activeSourceType === "paste" ? onPasteAgain() : activeProject && onReconnectProject(activeProject)}>{activeSourceType === "paste" ? <><Code2 aria-hidden='true' /> Paste source again</> : <><FolderOpen aria-hidden='true' /> Reconnect local folder</>}</button></div></div>
      ) : activeIsImage ? (
        <div className='asset-preview'><img src={activeSource} alt={`Preview of ${activeFile}`} /><span><b>{activeFile.split("/").at(-1)}</b><small>{sourceExtension(activeFile).toUpperCase()} image asset</small></span></div>
      ) : activeIsBinaryAsset ? (
        <div className='asset-preview binary-asset-preview'>{fileIcon(activeFile)}<span><b>{activeFile.split("/").at(-1)}</b><small>{sourceExtension(activeFile).toUpperCase()} binary asset · Preview unavailable</small></span></div>
      ) : (
        <pre ref={previewRef} data-file-category={fileCategory(activeFile)}><HighlightedCode source={activeSource} diagnostics={projectDetails[activeFile]?.insights?.diagnostics ?? []} highlightedLine={highlightedLocation?.file === activeFile ? highlightedLocation.line : 0} highlightedEndLine={highlightedLocation?.file === activeFile ? highlightedLocation.endLine : 0} /></pre>
      )}
    </div>
  );
});
