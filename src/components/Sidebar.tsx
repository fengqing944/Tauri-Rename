import { Copy, FilePlus, FolderOpen, FolderPlus, Play, RefreshCw, Wand2, X } from "lucide-react";
import type { Mode } from "../types";
import { shortName } from "../utils";

type SidebarProps = {
  mode: Mode;
  activeRoots: string[];
  copyFiles: string[];
  canProcess: boolean;
  isProcessing: boolean;
  dryRun: boolean;
  hasMappingDuplicates: boolean;
  onModeChange: (mode: Mode) => void;
  onChooseRoots: () => void;
  onClearRoots: () => void;
  onRemoveRoot: (path: string) => void;
  onChooseCopyFiles: () => void;
  onClearCopyFiles: () => void;
  onRemoveCopyFile: (path: string) => void;
  onRunProcess: () => void;
};

export function Sidebar({
  mode,
  activeRoots,
  copyFiles,
  canProcess,
  isProcessing,
  dryRun,
  hasMappingDuplicates,
  onModeChange,
  onChooseRoots,
  onClearRoots,
  onRemoveRoot,
  onChooseCopyFiles,
  onClearCopyFiles,
  onRemoveCopyFile,
  onRunProcess,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand-block">
        <div className="brand-mark">
          <Wand2 size={20} />
        </div>
        <div>
          <h1>Rename Studio</h1>
          <p>Tauri 2 桌面整理工具</p>
        </div>
      </div>

      <div className="mode-switch" aria-label="处理模式">
        <button
          className={mode === "single" ? "active" : ""}
          type="button"
          onClick={() => onModeChange("single")}
        >
          单文件夹
        </button>
        <button
          className={mode === "batch" ? "active" : ""}
          type="button"
          onClick={() => onModeChange("batch")}
        >
          多文件夹
        </button>
      </div>

      <section
        className="drop-zone"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => event.preventDefault()}
      >
        <FolderOpen size={28} />
        <strong>{activeRoots.length ? "待处理队列" : "拖入文件夹"}</strong>
        <span>{mode === "single" ? "当前仅保留一个根目录" : "每个根目录独立整理"}</span>
        <div className="drop-actions">
          <button className="primary-action" type="button" onClick={onChooseRoots}>
            <FolderPlus size={17} />
            选择文件夹
          </button>
          {activeRoots.length > 0 && (
            <button className="secondary-action" type="button" onClick={onClearRoots}>
              清空队列
            </button>
          )}
        </div>
      </section>

      <div className="path-list">
        {activeRoots.map((path) => (
          <div className="path-row" key={path} title={path}>
            <FolderOpen size={15} />
            <span>{shortName(path)}</span>
            <button type="button" title="移除" onClick={() => onRemoveRoot(path)}>
              <X size={14} />
            </button>
          </div>
        ))}
        {!activeRoots.length && <div className="empty-line">没有文件夹</div>}
      </div>

      <div className="sidebar-section">
        <div className="section-title">
          <Copy size={16} />
          <span>补充文件</span>
          {copyFiles.length > 0 && (
            <button className="mini-action" type="button" onClick={onClearCopyFiles}>
              清空
            </button>
          )}
        </div>
        <button className="ghost-action" type="button" onClick={onChooseCopyFiles}>
          <FilePlus size={16} />
          选择图片或 TXT
        </button>
        <div className="compact-list">
          {copyFiles.slice(0, 6).map((path) => (
            <div className="copy-chip" key={path} title={path}>
              <span>{shortName(path)}</span>
              <button type="button" title="移除" onClick={() => onRemoveCopyFile(path)}>
                <X size={12} />
              </button>
            </div>
          ))}
          {copyFiles.length > 6 && <div className="copy-chip">+{copyFiles.length - 6}</div>}
          {!copyFiles.length && <div className="copy-chip">未选择</div>}
        </div>
      </div>

      <button
        className="run-button"
        type="button"
        disabled={!canProcess}
        onClick={onRunProcess}
        title={hasMappingDuplicates ? "请先处理重复映射" : dryRun ? "生成预览" : "开始处理"}
      >
        {isProcessing ? <RefreshCw size={18} className="spin" /> : <Play size={18} />}
        {isProcessing ? "处理中" : dryRun ? "生成预览" : "开始处理"}
      </button>
    </aside>
  );
}
