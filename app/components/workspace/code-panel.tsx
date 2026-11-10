/* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */
import { memo, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import Check from "lucide-react/icons/check";
import ChevronRight from "lucide-react/icons/chevron-right";
import CloudOff from "lucide-react/icons/cloud-off";
import Code2 from "lucide-react/icons/code-2";
import Copy from "lucide-react/icons/copy";
import Ellipsis from "lucide-react/icons/ellipsis";
import FileCode2 from "lucide-react/icons/file-code-2";
import FolderOpen from "lucide-react/icons/folder-open";
import List from "lucide-react/icons/list";
import Minus from "lucide-react/icons/minus";
import Plus from "lucide-react/icons/plus";
import Search from "lucide-react/icons/search";
import WrapText from "lucide-react/icons/wrap-text";
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
  const findInputRef = useRef<HTMLInputElement>(null);
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [findMatchIndex, setFindMatchIndex] = useState(0);
  const [wordWrap, setWordWrap] = useState(false);
  const [codeFontSize, setCodeFontSize] = useState(13);
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
  const activeDetail = activeFile ? projectDetails[activeFile] : undefined;
  const highlightedExplanation = highlightedLocation?.file === activeFile
    ? activeDetail?.explanations?.find((item) => {
      const endLine = item.endLine ?? item.line;
      return highlightedLocation.line >= item.line && highlightedLocation.line <= endLine;
    })
    : undefined;
  const searchMatches = useMemo(() => {
    const query = findQuery.trim().toLocaleLowerCase();
    if (!query || !activeSource) return [];
    return activeSource.split("\n").flatMap((line, index) => line.toLocaleLowerCase().includes(query) ? [index + 1] : []);
  }, [activeSource, findQuery]);
  const activeSearchLine = searchMatches[findMatchIndex] ?? 0;
  const sourceLineCount = activeSource ? activeSource.split("\n").length : 0;

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

  useEffect(() => {
    setFindMatchIndex(0);
  }, [activeFile, findQuery]);

  useEffect(() => {
    if (!findOpen) return;
    findInputRef.current?.focus();
    findInputRef.current?.select();
  }, [findOpen]);

  useEffect(() => {
    if (!activeSearchLine) return;
    previewRef.current
      ?.querySelector<HTMLElement>(`[data-line="${activeSearchLine}"]`)
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeSearchLine]);

  useEffect(() => {
    const handleFindShortcut = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLocaleLowerCase() !== "f" || !activeFile) return;
      event.preventDefault();
      setFindOpen(true);
    };
    window.addEventListener("keydown", handleFindShortcut);
    return () => window.removeEventListener("keydown", handleFindShortcut);
  }, [activeFile]);

  const moveFindMatch = (direction: -1 | 1) => {
    if (!searchMatches.length) return;
    setFindMatchIndex((current) => (current + direction + searchMatches.length) % searchMatches.length);
  };

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
        <div className='code-tabs-overflow'>
          <button aria-label='Show all open files' title='Show all open files' aria-haspopup='menu' aria-expanded={menu === "codeTabs"} onClick={() => setMenu(menu === "codeTabs" ? null : "codeTabs")}><List aria-hidden='true' /></button>
          {menu === "codeTabs" && <div className='popover code-tabs-menu' role='menu'><header><b>Open files</b><small>{openFiles.length}</small></header>{openFiles.map((file) => <button className={file === activeFile ? "active" : ""} role='menuitem' key={file} onClick={() => { void onOpenFile(file); setMenu(null); }}>{fileIcon(file)}<span><b>{file.split("/").at(-1)}</b><small>{file}</small></span>{(projectDetails[file]?.insights?.diagnostics?.length ?? 0) > 0 && <i>{projectDetails[file]?.insights?.diagnostics?.length}</i>}</button>)}</div>}
        </div>
      </div>
      {activeFile && (
        <div className='code-source-bar'>
          <div className='code-breadcrumbs' title={activeFile}>
            {fileIcon(activeFile)}<span>{activeFile.split("/").map((part, index, parts) => <span key={`${part}-${index}`}><b>{part}</b>{index < parts.length - 1 && <ChevronRight aria-hidden='true' />}</span>)}</span>
            {highlightedLocation?.file === activeFile && <em>{lineRangeLabel(highlightedLocation.line, highlightedLocation.endLine)}</em>}
            {(activeDetail?.insights?.diagnostics?.length ?? 0) > 0 && <i>{activeDetail?.insights?.diagnostics?.length} issues</i>}
          </div>
          <div className='code-source-actions'>
            <button aria-label='Find in file' title='Find in file (Command or Control F)' onClick={() => setFindOpen(true)}><Search aria-hidden='true' /><span>Find</span></button>
            <button aria-label='More code actions' aria-expanded={menu === "codeActions"} title='More code actions' onClick={() => setMenu(menu === "codeActions" ? null : "codeActions")}><Ellipsis aria-hidden='true' /></button>
            {menu === "codeActions" && <div className='popover code-actions-menu' role='menu'>
              <header><b>Code actions</b><small>{sourceExtension(activeFile).toUpperCase()}</small></header>
              <button role='menuitem' onClick={() => { void navigator.clipboard?.writeText(activeSource); notify("Code copied"); setMenu(null); }}><Copy aria-hidden='true' /> Copy source</button>
              <button role='menuitem' onClick={() => { void navigator.clipboard?.writeText(activeFile); notify("File path copied"); setMenu(null); }}><FolderOpen aria-hidden='true' /> Copy file path</button>
              <button className={wordWrap ? "selected" : ""} role='menuitemcheckbox' aria-checked={wordWrap} onClick={() => setWordWrap((current) => !current)}><WrapText aria-hidden='true' /> Word wrap {wordWrap && <Check aria-hidden='true' />}</button>
              <div className='code-font-controls'><span>Code size</span><button aria-label='Decrease code font size' onClick={() => setCodeFontSize((current) => Math.max(11, current - 1))}><Minus aria-hidden='true' /></button><b>{codeFontSize}px</b><button aria-label='Increase code font size' onClick={() => setCodeFontSize((current) => Math.min(18, current + 1))}><Plus aria-hidden='true' /></button></div>
              <button role='menuitem' onClick={() => { setOpenFiles([activeFile]); setMenu(null); }}><X aria-hidden='true' /> Close other tabs</button>
              <button role='menuitem' onClick={() => { setOpenFiles([]); setActiveFile(""); setMenu(null); }}><X aria-hidden='true' /> Close all tabs</button>
            </div>}
          </div>
        </div>
      )}
      {activeFile && highlightedLocation?.file === activeFile && <div className='code-highlight-context'>
        <span><b>Why these lines?</b><p>{highlightedExplanation?.text ?? "This source range is connected to the selected graph item or inspector step."}</p></span>
        <em>{lineRangeLabel(highlightedLocation.line, highlightedLocation.endLine)}</em>
      </div>}
      {activeFile && findOpen && <div className='code-find-bar'>
        <Search aria-hidden='true' /><input ref={findInputRef} value={findQuery} onChange={(event) => setFindQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") moveFindMatch(event.shiftKey ? -1 : 1); if (event.key === "Escape") setFindOpen(false); }} placeholder='Find in file…' />
        <span>{findQuery ? `${searchMatches.length ? findMatchIndex + 1 : 0} of ${searchMatches.length}` : "0 results"}</span>
        <button disabled={!searchMatches.length} aria-label='Previous match' onClick={() => moveFindMatch(-1)}><ChevronRight aria-hidden='true' /></button>
        <button disabled={!searchMatches.length} aria-label='Next match' onClick={() => moveFindMatch(1)}><ChevronRight aria-hidden='true' /></button>
        <button aria-label='Close find' onClick={() => setFindOpen(false)}><X aria-hidden='true' /></button>
      </div>}
      {!activeFile ? (
        <div className='code-empty-state'><FileCode2 aria-hidden='true' /><b>No file open</b><p>Select a file in the Project Explorer to inspect its source.</p></div>
      ) : activeSourceMissing ? (
        <div className='missing-source-state'><CloudOff aria-hidden='true' /><div><b>{activeSourceType === "paste" ? "Pasted source is unavailable on this device" : "Source files are unavailable on this device"}</b><p>The graph and analysis were restored securely from the cloud, but Component Atlas does not upload private source code.</p><button onClick={() => activeSourceType === "paste" ? onPasteAgain() : activeProject && onReconnectProject(activeProject)}>{activeSourceType === "paste" ? <><Code2 aria-hidden='true' /> Paste source again</> : <><FolderOpen aria-hidden='true' /> Reconnect local folder</>}</button></div></div>
      ) : activeIsImage ? (
        <div className='asset-preview'><img src={activeSource} alt={`Preview of ${activeFile}`} /><span><b>{activeFile.split("/").at(-1)}</b><small>{sourceExtension(activeFile).toUpperCase()} image asset</small></span></div>
      ) : activeIsBinaryAsset ? (
        <div className='asset-preview binary-asset-preview'>{fileIcon(activeFile)}<span><b>{activeFile.split("/").at(-1)}</b><small>{sourceExtension(activeFile).toUpperCase()} binary asset · Preview unavailable</small></span></div>
      ) : (
        <pre className={wordWrap ? "word-wrap" : ""} ref={previewRef} data-file-category={fileCategory(activeFile)} style={{ fontSize: `${codeFontSize}px` }}><HighlightedCode source={activeSource} diagnostics={projectDetails[activeFile]?.insights?.diagnostics ?? []} highlightedLine={highlightedLocation?.file === activeFile ? highlightedLocation.line : 0} highlightedEndLine={highlightedLocation?.file === activeFile ? highlightedLocation.endLine : 0} searchQuery={findOpen ? findQuery : ""} activeSearchLine={findOpen ? activeSearchLine : 0} /></pre>
      )}
      {activeFile && <div className='code-status-bar'><span>{sourceExtension(activeFile).toUpperCase()}</span><span>{activeDetail?.insights?.framework?.[0] ?? fileCategory(activeFile)}</span><span>{sourceLineCount} lines</span>{(activeDetail?.insights?.diagnostics?.length ?? 0) > 0 && <i>{activeDetail?.insights?.diagnostics?.length} issues</i>}{highlightedLocation?.file === activeFile && <em>{lineRangeLabel(highlightedLocation.line, highlightedLocation.endLine)}</em>}</div>}
    </div>
  );
});
