/* eslint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex, jsx-a11y/no-static-element-interactions */
import { memo, useMemo, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from "react";
import Check from "lucide-react/icons/check";
import ChevronDown from "lucide-react/icons/chevron-down";
import ChevronRight from "lucide-react/icons/chevron-right";
import Filter from "lucide-react/icons/filter";
import FolderOpen from "lucide-react/icons/folder-open";
import PanelLeft from "lucide-react/icons/panel-left";
import PanelRight from "lucide-react/icons/panel-right";
import Search from "lucide-react/icons/search";
import Upload from "lucide-react/icons/upload";
import X from "lucide-react/icons/x";
import { useShallow } from "zustand/react/shallow";
import { fileCategory, fileIcon, fileTabIcon, sourceExtension } from "../../lib/file-types";
import { useEditorStore } from "../../stores/editor-store";
import { useWorkspaceUiStore, type FileTab } from "../../stores/ui-store";
import type { NodeDetail } from "../../types/workspace";

const FILE_TABS: FileTab[] = ["Files", "Components", "Routes", "Hooks", "Styles", "Assets"];
type ExplorerSort = "directory" | "name" | "issues";

const highlightMatch = (value: string, query: string) => {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return value;
  const index = value.toLocaleLowerCase().indexOf(normalized);
  if (index < 0) return value;
  return <>{value.slice(0, index)}<mark>{value.slice(index, index + normalized.length)}</mark>{value.slice(index + normalized.length)}</>;
};

type Props = {
  projectFiles: string[];
  filteredFiles: string[];
  projectDetails: Record<string, NodeDetail>;
  fileTabCounts: Record<FileTab, number>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  reconnectInputRef: RefObject<HTMLInputElement | null>;
  fileSearchRef: RefObject<HTMLInputElement | null>;
  onFilesChange: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  onReconnectChange: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  onOpenFile: (file: string) => void | Promise<void>;
  onResizeStart: (event: ReactPointerEvent<HTMLDivElement>) => void;
  notify: (message: string) => void;
};

export const ProjectExplorer = memo(function ProjectExplorer({
  projectFiles,
  filteredFiles,
  projectDetails,
  fileTabCounts,
  fileInputRef,
  reconnectInputRef,
  fileSearchRef,
  onFilesChange,
  onReconnectChange,
  onOpenFile,
  onResizeStart,
  notify,
}: Props) {
  const { activeFile, fileQuery, expandedFolders, setFileQuery, setExpandedFolders } = useEditorStore(useShallow((state) => ({
    activeFile: state.activeFile,
    fileQuery: state.fileQuery,
    expandedFolders: state.expandedFolders,
    setFileQuery: state.setFileQuery,
    setExpandedFolders: state.setExpandedFolders,
  })));
  const { explorerCollapsed, explorerWidth, fileTab, menu, setExplorerCollapsed, setExplorerWidth, setFileTab, setMenu, setModal } = useWorkspaceUiStore(useShallow((state) => ({
    explorerCollapsed: state.explorerCollapsed,
    explorerWidth: state.explorerWidth,
    fileTab: state.fileTab,
    menu: state.menu,
    setExplorerCollapsed: state.setExplorerCollapsed,
    setExplorerWidth: state.setExplorerWidth,
    setFileTab: state.setFileTab,
    setMenu: state.setMenu,
    setModal: state.setModal,
  })));
  const [issuesOnly, setIssuesOnly] = useState(false);
  const [sortMode, setSortMode] = useState<ExplorerSort>("directory");
  const totalIssues = useMemo(
    () => projectFiles.reduce((total, file) => total + (projectDetails[file]?.insights?.diagnostics?.length ?? 0), 0),
    [projectDetails, projectFiles],
  );
  const visibleFiles = useMemo(
    () => issuesOnly
      ? filteredFiles.filter((file) => (projectDetails[file]?.insights?.diagnostics?.length ?? 0) > 0)
      : filteredFiles,
    [filteredFiles, issuesOnly, projectDetails],
  );

  const treeRows = useMemo(() => {
    type TreeNode = { folders: Map<string, TreeNode>; files: string[] };
    const root: TreeNode = { folders: new Map(), files: [] };
    visibleFiles.slice().sort((a, b) => a.localeCompare(b)).forEach((file) => {
      const parts = file.split("/");
      let node = root;
      parts.slice(0, -1).forEach((folder) => {
        if (!node.folders.has(folder)) node.folders.set(folder, { folders: new Map(), files: [] });
        node = node.folders.get(folder)!;
      });
      node.files.push(file);
    });
    const rows: ReactNode[] = [];
    const nestedFiles = (node: TreeNode): string[] => [...node.files, ...Array.from(node.folders.values()).flatMap(nestedFiles)];
    const renderNode = (node: TreeNode, parentPath: string, depth: number) => {
      const folderEntries = Array.from(node.folders.entries()).sort(([leftName, left], [rightName, right]) => {
        if (sortMode === "issues") {
          const leftIssues = nestedFiles(left).reduce((total, file) => total + (projectDetails[file]?.insights?.diagnostics?.length ?? 0), 0);
          const rightIssues = nestedFiles(right).reduce((total, file) => total + (projectDetails[file]?.insights?.diagnostics?.length ?? 0), 0);
          if (rightIssues !== leftIssues) return rightIssues - leftIssues;
        }
        return leftName.localeCompare(rightName);
      });
      folderEntries.forEach(([name, child]) => {
        const path = parentPath ? `${parentPath}/${name}` : name;
        const open = fileQuery ? true : expandedFolders.has(path);
        const files = nestedFiles(child);
        const issueCount = files.reduce((total, file) => total + (projectDetails[file]?.insights?.diagnostics?.length ?? 0), 0);
        const toggleFolder = () => setExpandedFolders((current) => {
          const next = new Set(current);
          if (next.has(path)) next.delete(path); else next.add(path);
          return next;
        });
        rows.push(
          <button aria-expanded={open} className={`directory-row ${open ? "is-open" : ""}`} data-depth={depth} key={`folder:${path}`} style={{ paddingLeft: `${14 + depth * 16}px` }} title={`${path} · ${files.length} file${files.length === 1 ? "" : "s"}`} onClick={toggleFolder} onKeyDown={(event) => {
            if (event.key === "ArrowRight" && !open) { event.preventDefault(); toggleFolder(); }
            if (event.key === "ArrowLeft" && open) { event.preventDefault(); toggleFolder(); }
          }}>
            {open ? <ChevronDown aria-hidden='true' /> : <ChevronRight aria-hidden='true' />}
            <FolderOpen aria-hidden='true' /><span className='file-name'>{highlightMatch(name, fileQuery)}</span>
            {issueCount > 0 && <i className='tree-issue-count' title={`${issueCount} analysis issues`}>{issueCount}</i>}
            <em>{files.length}</em>
          </button>,
        );
        if (open) renderNode(child, path, depth + 1);
      });
      node.files.slice().sort((left, right) => {
        if (sortMode === "issues") {
          const issueDifference = (projectDetails[right]?.insights?.diagnostics?.length ?? 0) - (projectDetails[left]?.insights?.diagnostics?.length ?? 0);
          if (issueDifference) return issueDifference;
        }
        return left.split("/").at(-1)!.localeCompare(right.split("/").at(-1)!);
      }).forEach((file) => {
        const extension = sourceExtension(file);
        const issueCount = projectDetails[file]?.insights?.diagnostics?.length ?? 0;
        rows.push(
          <button aria-current={file === activeFile ? "page" : undefined} className={`${file === activeFile ? "active-file " : ""}${issueCount ? "has-tree-issues " : ""}file-row file-type-${extension} file-category-${fileCategory(file)}`} data-depth={depth} key={file} style={{ paddingLeft: `${22 + depth * 16}px` }} title={`${file} · ${extension.toUpperCase()} ${fileCategory(file)} · Right-click to copy path`} onClick={() => void onOpenFile(file)} onContextMenu={(event) => {
            event.preventDefault();
            void navigator.clipboard?.writeText(file);
            notify(`Copied ${file}`);
          }}>
            {fileIcon(file)}<span className='file-name'>{highlightMatch(file.split("/").at(-1) ?? file, fileQuery)}</span>
            {issueCount > 0 && <i className='tree-issue-count' title={`${issueCount} analysis issue${issueCount === 1 ? "" : "s"}`}>{issueCount}</i>}
            <em className='file-extension'>{extension}</em>
          </button>,
        );
      });
    };
    renderNode(root, "", 0);
    return rows;
  }, [activeFile, expandedFolders, fileQuery, notify, onOpenFile, projectDetails, setExpandedFolders, sortMode, visibleFiles]);

  return (
    <aside className={`explorer ${explorerCollapsed ? "panel-collapsed" : ""}`}>
      <div className='section-label'><span className='panel-title'>PROJECT EXPLORER</span><button className='panel-toggle' type='button' aria-label={explorerCollapsed ? "Expand project explorer" : "Collapse project explorer"} title={explorerCollapsed ? "Expand project explorer" : "Collapse project explorer"} aria-expanded={!explorerCollapsed} onClick={() => setExplorerCollapsed((current) => !current)}>{explorerCollapsed ? <PanelRight aria-hidden='true' /> : <PanelLeft aria-hidden='true' />}</button></div>
      <div className='explorer-project-actions' onClick={(event) => event.stopPropagation()}>
        <button className='import-button' title='Import project (Command I on Mac, Control I on Windows/Linux)' onClick={() => setModal("import")}><Upload aria-hidden='true' /><b>Import project</b><span>⌘ I / Ctrl I</span></button>
      </div>
      <input ref={fileInputRef} className='hidden-input' type='file' multiple onChange={onFilesChange} {...({ webkitdirectory: "" } as { webkitdirectory: string })} />
      <input ref={reconnectInputRef} className='hidden-input' type='file' multiple onChange={onReconnectChange} {...({ webkitdirectory: "" } as { webkitdirectory: string })} />
      <label className='file-search explorer-search' title='Focus file search (Option F on Mac, Alt F on Windows/Linux)'><Search aria-hidden='true' /><input ref={fileSearchRef} value={fileQuery} onChange={(event) => setFileQuery(event.target.value)} placeholder='Search files and paths…' />{fileQuery ? <button aria-label='Clear file search' onClick={(event) => { event.preventDefault(); setFileQuery(""); }}><X aria-hidden='true' /></button> : <kbd>⌥ F</kbd>}</label>
      <div className='explorer-view-toolbar' onClick={(event) => event.stopPropagation()}>
        <div className='file-view-selector menu-wrap'>
          <button className={menu === "fileView" ? "active" : ""} aria-haspopup='menu' aria-expanded={menu === "fileView"} onClick={() => setMenu(menu === "fileView" ? null : "fileView")}><small>Browse by</small><span>{fileTabIcon(fileTab)}<b>{fileTab}</b></span><em>{fileTabCounts[fileTab]}</em><ChevronDown aria-hidden='true' /></button>
          {menu === "fileView" && <div className='popover file-view-menu' role='menu' aria-label='Choose project file category'>{FILE_TABS.map((tab) => <button className={fileTab === tab ? "selected" : ""} role='menuitemradio' aria-checked={fileTab === tab} key={tab} onClick={() => { setFileTab(tab); setMenu(null); }}><span>{fileTabIcon(tab)}<b>{tab}</b></span><small>{fileTabCounts[tab]}</small>{fileTab === tab ? <Check aria-hidden='true' /> : null}</button>)}</div>}
        </div>
        <div className='explorer-filter-wrap menu-wrap'>
          <button className={menu === "explorerFilter" || issuesOnly || sortMode !== "directory" ? "active" : ""} aria-label='Filter and sort project files' aria-haspopup='menu' aria-expanded={menu === "explorerFilter"} onClick={() => setMenu(menu === "explorerFilter" ? null : "explorerFilter")}><Filter aria-hidden='true' />{issuesOnly && <i>1</i>}</button>
          {menu === "explorerFilter" && <div className='popover explorer-filter-menu' role='menu'>
            <header><b>Filter and sort</b><button onClick={() => { setIssuesOnly(false); setSortMode("directory"); }}>Reset</button></header>
            <strong>Show</strong>
            <button className={issuesOnly ? "selected" : ""} role='menuitemcheckbox' aria-checked={issuesOnly} onClick={() => setIssuesOnly((current) => !current)}><span><b>Files with issues</b><small>Hide files without diagnostics</small></span>{issuesOnly && <Check aria-hidden='true' />}</button>
            <strong>Sort</strong>
            {(["directory", "name", "issues"] as ExplorerSort[]).map((option) => <button className={sortMode === option ? "selected" : ""} role='menuitemradio' aria-checked={sortMode === option} key={option} onClick={() => setSortMode(option)}><span><b>{option === "directory" ? "Directory order" : option === "name" ? "File name" : "Most issues"}</b><small>{option === "issues" ? "Problematic files first" : option === "name" ? "Alphabetical within folders" : "Folders before files"}</small></span>{sortMode === option && <Check aria-hidden='true' />}</button>)}
          </div>}
        </div>
      </div>
      <div className='file-tree' aria-label='Project files' onKeyDown={(event) => {
        if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
        const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>(".directory-row, .file-row"));
        if (!buttons.length) return;
        const current = (event.target as Element).closest<HTMLButtonElement>("button");
        const index = Math.max(0, buttons.indexOf(current ?? buttons[0]));
        const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : event.key === "ArrowDown" ? Math.min(buttons.length - 1, index + 1) : Math.max(0, index - 1);
        event.preventDefault();
        buttons[nextIndex]?.focus();
      }}>
        <div className='folder'><ChevronDown aria-hidden='true' /><FolderOpen aria-hidden='true' /><b>Project</b>{totalIssues > 0 && <i>{totalIssues} issues</i>}<span>{visibleFiles.length}</span></div>
        {treeRows}
        {!visibleFiles.length && <div className='empty-state explorer-empty-state'><Search aria-hidden='true' /><b>{projectFiles.length ? "No matching files" : "No project loaded"}</b><span>{projectFiles.length ? "Try another filename or adjust the browse and filter options." : "Import a supported project to explore its directory."}</span>{fileQuery ? <button onClick={() => setFileQuery("")}>Clear search</button> : issuesOnly ? <button onClick={() => setIssuesOnly(false)}>Clear filter</button> : !projectFiles.length ? <button onClick={() => setModal("import")}>Import project</button> : null}</div>}
      </div>
      <div className='explorer-footer'><span><i />{projectFiles.length} files available</span>{totalIssues > 0 && <button onClick={() => setModal("diagnostics")}><b>{totalIssues}</b> issues</button>}</div>
      <div className='resize-handle resize-right' role='separator' tabIndex={0} aria-label='Resize project explorer' aria-orientation='vertical' aria-valuemin={250} aria-valuemax={460} aria-valuenow={explorerWidth} onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        setExplorerWidth((current) => Math.min(460, Math.max(250, current + (event.key === "ArrowRight" ? 10 : -10))));
      }} onPointerDown={onResizeStart} />
    </aside>
  );
});
