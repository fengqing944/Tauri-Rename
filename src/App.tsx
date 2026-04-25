import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open } from "@tauri-apps/plugin-dialog";
import {
  AlertTriangle,
  CheckCircle,
  Copy,
  FilePlus,
  FolderOpen,
  FolderPlus,
  Image,
  Info,
  ListChecks,
  Minus,
  Play,
  Plus,
  RefreshCw,
  Settings,
  Wand2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";

type Mode = "single" | "batch";

type FolderNames = {
  images: string;
  videos: string;
  gifs: string;
  texts: string;
};

type DirectoryMapping = {
  from: string;
  to: string;
};

type LogEntry = {
  level: "info" | "success" | "warn" | string;
  message: string;
  path?: string | null;
};

type ProcessReport = {
  rootsProcessed: number;
  foldersCreated: number;
  foldersRenamed: number;
  filesMoved: number;
  filesRenamed: number;
  filesCopied: number;
  skipped: number;
  logPath?: string | null;
  entries: LogEntry[];
};

type FolderPreset = {
  id: string;
  name: string;
  folders: FolderNames;
};

const folderPresets: FolderPreset[] = [
  {
    id: "cn-standard",
    name: "中文归档",
    folders: { images: "图包", videos: "视频", gifs: "GIF", texts: "文本" },
  },
  {
    id: "creator-pack",
    name: "作品包",
    folders: { images: "图片", videos: "视频", gifs: "动图", texts: "文档" },
  },
  {
    id: "en-clean",
    name: "English",
    folders: { images: "Images", videos: "Videos", gifs: "GIF", texts: "Text" },
  },
];

const defaultMappings: DirectoryMapping[] = [
  { from: "Pic", to: "图包" },
  { from: "Pics", to: "图包" },
  { from: "Picture", to: "图包" },
  { from: "Pictures", to: "图包" },
  { from: "Image", to: "图包" },
  { from: "Images", to: "图包" },
  { from: "Video", to: "视频" },
  { from: "Videos", to: "视频" },
  { from: "Movie", to: "视频" },
  { from: "Movies", to: "视频" },
  { from: "Gif", to: "GIF" },
  { from: "GIFs", to: "GIF" },
  { from: "Text", to: "文本" },
  { from: "TXT", to: "文本" },
];

const copyableExtensions = [
  "jpg",
  "jpeg",
  "png",
  "webp",
  "bmp",
  "tif",
  "tiff",
  "avif",
  "heic",
  "heif",
  "gif",
  "txt",
];

function normalizeSelection(selection: string | string[] | null): string[] {
  if (!selection) return [];
  return Array.isArray(selection) ? selection : [selection];
}

function shortName(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : path;
}

function uniqueMerge(current: string[], incoming: string[], mode: Mode): string[] {
  const merged = [...current];

  for (const path of incoming) {
    if (!merged.includes(path)) {
      merged.push(path);
    }
  }

  return mode === "single" ? merged.slice(-1) : merged;
}

function parseSpecialDirs(value: string): string[] {
  return value
    .split(/[\n,，]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function App() {
  const [mode, setMode] = useState<Mode>("single");
  const [roots, setRoots] = useState<string[]>([]);
  const [copyFiles, setCopyFiles] = useState<string[]>([]);
  const [presetId, setPresetId] = useState(folderPresets[0].id);
  const [folderNames, setFolderNames] = useState<FolderNames>(folderPresets[0].folders);
  const [mappings, setMappings] = useState<DirectoryMapping[]>(defaultMappings);
  const [specialDirs, setSpecialDirs] = useState("特典, Bonus, Extras");
  const [copyExtras, setCopyExtras] = useState(true);
  const [includeText, setIncludeText] = useState(false);
  const [dryRun, setDryRun] = useState(false);
  const [renamePattern, setRenamePattern] = useState("{folder}_{category}_{index}");
  const [startIndex, setStartIndex] = useState(1);
  const [padding, setPadding] = useState(3);
  const [isProcessing, setIsProcessing] = useState(false);
  const [report, setReport] = useState<ProcessReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeRoots = useMemo(() => (mode === "single" ? roots.slice(0, 1) : roots), [mode, roots]);
  const canProcess = activeRoots.length > 0 && !isProcessing;

  const addRoots = useCallback(
    (paths: string[]) => {
      if (paths.length === 0) return;
      setRoots((current) => uniqueMerge(current, paths, mode));
      setReport(null);
      setError(null);
    },
    [mode],
  );

  useEffect(() => {
    if (mode === "single") {
      setRoots((current) => current.slice(0, 1));
    }
  }, [mode]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    getCurrentWindow()
      .onDragDropEvent((event) => {
        if (event.payload.type === "drop") {
          addRoots(event.payload.paths);
        }
      })
      .then((dispose) => {
        unlisten = dispose;
      })
      .catch(() => undefined);

    return () => {
      unlisten?.();
    };
  }, [addRoots]);

  const chooseRoots = async () => {
    const selection = await open({
      directory: true,
      multiple: mode === "batch",
      title: "选择待处理文件夹",
    });
    addRoots(normalizeSelection(selection));
  };

  const chooseCopyFiles = async () => {
    const selection = await open({
      directory: false,
      multiple: true,
      title: "选择补充文件",
      filters: [{ name: "图片 / GIF / TXT", extensions: copyableExtensions }],
    });
    const paths = normalizeSelection(selection);
    setCopyFiles((current) => uniqueMerge(current, paths, "batch"));
  };

  const applyPreset = (id: string) => {
    const preset = folderPresets.find((item) => item.id === id);
    if (!preset) return;
    setPresetId(id);
    setFolderNames(preset.folders);
  };

  const updateFolderName = (key: keyof FolderNames, value: string) => {
    setFolderNames((current) => ({ ...current, [key]: value }));
  };

  const updateMapping = (index: number, key: keyof DirectoryMapping, value: string) => {
    setMappings((current) =>
      current.map((mapping, itemIndex) =>
        itemIndex === index ? { ...mapping, [key]: value } : mapping,
      ),
    );
  };

  const removeMapping = (index: number) => {
    setMappings((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const runProcess = async () => {
    if (!canProcess) return;

    setIsProcessing(true);
    setError(null);
    setReport(null);

    try {
      const result = await invoke<ProcessReport>("process_rename", {
        request: {
          roots: activeRoots,
          folderNames,
          mappings: mappings.filter((mapping) => mapping.from.trim() && mapping.to.trim()),
          specialDirs: parseSpecialDirs(specialDirs),
          copyFiles,
          copyExtras,
          renamePattern,
          startIndex: Math.max(1, Number(startIndex) || 1),
          padding: Math.min(8, Math.max(1, Number(padding) || 3)),
          dryRun,
          includeText,
        },
      });
      setReport(result);
    } catch (processError) {
      setError(processError instanceof Error ? processError.message : String(processError));
    } finally {
      setIsProcessing(false);
    }
  };

  const latestEntries = report?.entries.slice(-160).reverse() ?? [];

  return (
    <main className="app-shell">
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
            onClick={() => setMode("single")}
          >
            单文件夹
          </button>
          <button
            className={mode === "batch" ? "active" : ""}
            type="button"
            onClick={() => setMode("batch")}
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
          <button className="primary-action" type="button" onClick={chooseRoots}>
            <FolderPlus size={17} />
            选择文件夹
          </button>
        </section>

        <div className="path-list">
          {activeRoots.map((path) => (
            <div className="path-row" key={path} title={path}>
              <FolderOpen size={15} />
              <span>{shortName(path)}</span>
              <button
                type="button"
                title="移除"
                onClick={() => setRoots((current) => current.filter((item) => item !== path))}
              >
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
          </div>
          <button className="ghost-action" type="button" onClick={chooseCopyFiles}>
            <FilePlus size={16} />
            选择图片或 TXT
          </button>
          <div className="compact-list">
            {copyFiles.slice(0, 6).map((path) => (
              <span key={path} title={path}>
                {shortName(path)}
              </span>
            ))}
            {copyFiles.length > 6 && <span>+{copyFiles.length - 6}</span>}
            {!copyFiles.length && <span>未选择</span>}
          </div>
        </div>

        <button
          className="run-button"
          type="button"
          disabled={!canProcess}
          onClick={runProcess}
          title={dryRun ? "生成预览" : "开始处理"}
        >
          {isProcessing ? <RefreshCw size={18} className="spin" /> : <Play size={18} />}
          {isProcessing ? "处理中" : dryRun ? "生成预览" : "开始处理"}
        </button>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">规则面板</span>
            <h2>分类、映射、重命名</h2>
          </div>
          <div className="status-strip">
            <span>
              <FolderOpen size={14} />
              {activeRoots.length} 个目录
            </span>
            <span>
              <Image size={14} />
              {copyFiles.length} 个补充文件
            </span>
            <span className={dryRun ? "accent-warning" : "accent-ready"}>
              {dryRun ? "预览" : "执行"}
            </span>
          </div>
        </header>

        <div className="content-grid">
          <section className="panel rules-panel">
            <div className="panel-heading">
              <div>
                <Settings size={18} />
                <h3>命名规则</h3>
              </div>
              <select value={presetId} onChange={(event) => applyPreset(event.target.value)}>
                {folderPresets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="folder-grid">
              <label>
                图像目录
                <input
                  value={folderNames.images}
                  onChange={(event) => updateFolderName("images", event.target.value)}
                />
              </label>
              <label>
                视频目录
                <input
                  value={folderNames.videos}
                  onChange={(event) => updateFolderName("videos", event.target.value)}
                />
              </label>
              <label>
                GIF 目录
                <input
                  value={folderNames.gifs}
                  onChange={(event) => updateFolderName("gifs", event.target.value)}
                />
              </label>
              <label>
                文本目录
                <input
                  value={folderNames.texts}
                  onChange={(event) => updateFolderName("texts", event.target.value)}
                />
              </label>
            </div>

            <div className="pattern-row">
              <label>
                文件名模板
                <input value={renamePattern} onChange={(event) => setRenamePattern(event.target.value)} />
              </label>
              <label>
                起始
                <input
                  min={1}
                  type="number"
                  value={startIndex}
                  onChange={(event) => setStartIndex(Number(event.target.value))}
                />
              </label>
              <label>
                位数
                <input
                  min={1}
                  max={8}
                  type="number"
                  value={padding}
                  onChange={(event) => setPadding(Number(event.target.value))}
                />
              </label>
            </div>

            <div className="toggle-grid">
              <label className="check-row">
                <input
                  checked={copyExtras}
                  type="checkbox"
                  onChange={(event) => setCopyExtras(event.target.checked)}
                />
                <span>复制补充文件到根目录</span>
              </label>
              <label className="check-row">
                <input
                  checked={includeText}
                  type="checkbox"
                  onChange={(event) => setIncludeText(event.target.checked)}
                />
                <span>TXT 参与分类</span>
              </label>
              <label className="check-row">
                <input checked={dryRun} type="checkbox" onChange={(event) => setDryRun(event.target.checked)} />
                <span>预览模式</span>
              </label>
            </div>
          </section>

          <section className="panel mapping-panel">
            <div className="panel-heading">
              <div>
                <ListChecks size={18} />
                <h3>目录映射</h3>
              </div>
              <button type="button" title="新增映射" onClick={() => setMappings((current) => [...current, { from: "", to: "图包" }])}>
                <Plus size={16} />
              </button>
            </div>

            <div className="mapping-list">
              {mappings.map((mapping, index) => (
                <div className="mapping-row" key={`${mapping.from}-${index}`}>
                  <input
                    value={mapping.from}
                    placeholder="Pic"
                    onChange={(event) => updateMapping(index, "from", event.target.value)}
                  />
                  <span>→</span>
                  <input
                    value={mapping.to}
                    placeholder="图包"
                    onChange={(event) => updateMapping(index, "to", event.target.value)}
                  />
                  <button type="button" title="删除映射" onClick={() => removeMapping(index)}>
                    <Minus size={15} />
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="panel special-panel">
            <div className="panel-heading">
              <div>
                <AlertTriangle size={18} />
                <h3>特殊目录</h3>
              </div>
            </div>
            <textarea value={specialDirs} onChange={(event) => setSpecialDirs(event.target.value)} />
          </section>

          <section className="panel report-panel">
            <div className="panel-heading">
              <div>
                <Info size={18} />
                <h3>日志</h3>
              </div>
              {report?.logPath && <span className="log-path" title={report.logPath}>{shortName(report.logPath)}</span>}
            </div>

            {error && (
              <div className="error-box">
                <AlertTriangle size={17} />
                {error}
              </div>
            )}

            {report && (
              <div className="stats-grid">
                <span>目录 {report.rootsProcessed}</span>
                <span>创建 {report.foldersCreated}</span>
                <span>映射 {report.foldersRenamed}</span>
                <span>移动 {report.filesMoved}</span>
                <span>重命名 {report.filesRenamed}</span>
                <span>复制 {report.filesCopied}</span>
                <span>跳过 {report.skipped}</span>
              </div>
            )}

            <div className="log-list">
              {latestEntries.map((entry, index) => (
                <div className={`log-row ${entry.level}`} key={`${entry.message}-${index}`}>
                  {entry.level === "success" ? <CheckCircle size={15} /> : entry.level === "warn" ? <AlertTriangle size={15} /> : <Info size={15} />}
                  <div>
                    <strong>{entry.message}</strong>
                    {entry.path && <span>{entry.path}</span>}
                  </div>
                </div>
              ))}
              {!latestEntries.length && <div className="empty-log">等待任务</div>}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

export default App;
