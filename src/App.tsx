import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open } from "@tauri-apps/plugin-dialog";
import {
  AlertTriangle,
  ArrowDownUp,
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
  Search,
  Settings,
  Wand2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";

type Mode = "single" | "batch";
type RuleTab = "rules" | "mapping" | "special" | "log";

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

type PersistedSettings = {
  version: 1;
  mode?: Mode;
  presetId?: string;
  folderNames?: FolderNames;
  mappings?: DirectoryMapping[];
  specialDirs?: string[];
  copyFiles?: string[];
  copyExtras?: boolean;
  includeText?: boolean;
  dryRun?: boolean;
  reverseRenameOrder?: boolean;
  renamePattern?: string;
  startIndex?: number;
  padding?: number;
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

const settingsStorageKey = "rename-studio-settings-v1";
const defaultFolderNames = folderPresets[0].folders;
const defaultSpecialDirs = ["Bonus", "Extras", "特典"];
const defaultRenamePattern = "{folder}_{category}_{index}";

function normalizeSelection(selection: string | string[] | null): string[] {
  if (!selection) return [];
  return Array.isArray(selection) ? selection : [selection];
}

function shortName(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : path;
}

function normalizeKey(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, "zh-Hans-CN", {
    numeric: true,
    sensitivity: "base",
  });
}

function sortMappings(items: DirectoryMapping[]): DirectoryMapping[] {
  return [...items].sort((left, right) => {
    const fromCompare = compareText(left.from, right.from);
    return fromCompare === 0 ? compareText(left.to, right.to) : fromCompare;
  });
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

function splitNames(value: string): string[] {
  return value
    .split(/[\n,，]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function findDuplicateMappingKeys(mappings: DirectoryMapping[]): Set<string> {
  const counts = new Map<string, number>();

  for (const mapping of mappings) {
    const key = normalizeKey(mapping.from);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key));
}

function isMode(value: unknown): value is Mode {
  return value === "single" || value === "batch";
}

function isFolderNames(value: unknown): value is FolderNames {
  if (!value || typeof value !== "object") return false;
  const folderNames = value as Record<string, unknown>;
  return ["images", "videos", "gifs", "texts"].every(
    (key) => typeof folderNames[key] === "string",
  );
}

function cleanStringArray(value: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(value)) return fallback;
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function cleanMappings(value: unknown): DirectoryMapping[] {
  if (!Array.isArray(value)) return sortMappings(defaultMappings);

  const seen = new Set<string>();
  const mappings = value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Record<string, unknown>;
    if (typeof candidate.from !== "string" || typeof candidate.to !== "string") return [];

    const from = candidate.from.trim();
    const to = candidate.to.trim();
    const key = normalizeKey(from);
    if (!from || !to || seen.has(key)) return [];

    seen.add(key);
    return [{ from, to }];
  });

  return mappings.length ? sortMappings(mappings) : sortMappings(defaultMappings);
}

function readPersistedSettings(): Partial<PersistedSettings> {
  try {
    const raw = localStorage.getItem(settingsStorageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<PersistedSettings>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writePersistedSettings(settings: PersistedSettings) {
  try {
    localStorage.setItem(settingsStorageKey, JSON.stringify(settings));
  } catch {
    // Settings persistence is best-effort; file operations must keep working.
  }
}

function App() {
  const savedSettings = useMemo(() => readPersistedSettings(), []);
  const [mode, setMode] = useState<Mode>(() =>
    isMode(savedSettings.mode) ? savedSettings.mode : "single",
  );
  const [activeTab, setActiveTab] = useState<RuleTab>("rules");
  const [roots, setRoots] = useState<string[]>([]);
  const [copyFiles, setCopyFiles] = useState<string[]>(() => cleanStringArray(savedSettings.copyFiles));
  const [presetId, setPresetId] = useState(() =>
    typeof savedSettings.presetId === "string" &&
    folderPresets.some((preset) => preset.id === savedSettings.presetId)
      ? savedSettings.presetId
      : folderPresets[0].id,
  );
  const [folderNames, setFolderNames] = useState<FolderNames>(() =>
    isFolderNames(savedSettings.folderNames) ? savedSettings.folderNames : defaultFolderNames,
  );
  const [mappings, setMappings] = useState<DirectoryMapping[]>(() =>
    cleanMappings(savedSettings.mappings),
  );
  const [mappingQuery, setMappingQuery] = useState("");
  const [mappingDraft, setMappingDraft] = useState<DirectoryMapping>({ from: "", to: "图包" });
  const [specialDirs, setSpecialDirs] = useState<string[]>(() =>
    cleanStringArray(savedSettings.specialDirs, defaultSpecialDirs).sort(compareText),
  );
  const [specialInput, setSpecialInput] = useState("");
  const [specialQuery, setSpecialQuery] = useState("");
  const [copyExtras, setCopyExtras] = useState(() =>
    typeof savedSettings.copyExtras === "boolean" ? savedSettings.copyExtras : true,
  );
  const [includeText, setIncludeText] = useState(() => savedSettings.includeText === true);
  const [dryRun, setDryRun] = useState(() => savedSettings.dryRun === true);
  const [reverseRenameOrder, setReverseRenameOrder] = useState(
    () => savedSettings.reverseRenameOrder === true,
  );
  const [renamePattern, setRenamePattern] = useState(() =>
    typeof savedSettings.renamePattern === "string" && savedSettings.renamePattern.trim()
      ? savedSettings.renamePattern
      : defaultRenamePattern,
  );
  const [startIndex, setStartIndex] = useState(() =>
    typeof savedSettings.startIndex === "number" && savedSettings.startIndex > 0
      ? savedSettings.startIndex
      : 1,
  );
  const [padding, setPadding] = useState(() =>
    typeof savedSettings.padding === "number" && savedSettings.padding > 0 ? savedSettings.padding : 3,
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [report, setReport] = useState<ProcessReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeRoots = useMemo(() => (mode === "single" ? roots.slice(0, 1) : roots), [mode, roots]);
  const duplicateMappingKeys = useMemo(() => findDuplicateMappingKeys(mappings), [mappings]);
  const hasMappingDuplicates = duplicateMappingKeys.size > 0;
  const canProcess = activeRoots.length > 0 && !isProcessing && !hasMappingDuplicates;

  const mappingRows = useMemo(() => {
    const query = normalizeKey(mappingQuery);
    return mappings
      .map((mapping, index) => ({ mapping, index }))
      .filter(({ mapping }) => {
        if (!query) return true;
        return normalizeKey(`${mapping.from} ${mapping.to}`).includes(query);
      })
      .sort((left, right) => {
        const fromCompare = compareText(left.mapping.from, right.mapping.from);
        return fromCompare === 0
          ? compareText(left.mapping.to, right.mapping.to)
          : fromCompare;
      });
  }, [mappingQuery, mappings]);

  const specialRows = useMemo(() => {
    const query = normalizeKey(specialQuery);
    return specialDirs
      .filter((name) => !query || normalizeKey(name).includes(query))
      .sort(compareText);
  }, [specialDirs, specialQuery]);

  const mappingDraftDuplicate = useMemo(
    () =>
      Boolean(mappingDraft.from.trim()) &&
      mappings.some((mapping) => normalizeKey(mapping.from) === normalizeKey(mappingDraft.from)),
    [mappingDraft.from, mappings],
  );

  const latestEntries = report?.entries.slice(-80).reverse() ?? [];

  useEffect(() => {
    writePersistedSettings({
      version: 1,
      mode,
      presetId,
      folderNames,
      mappings,
      specialDirs,
      copyFiles,
      copyExtras,
      includeText,
      dryRun,
      reverseRenameOrder,
      renamePattern,
      startIndex,
      padding,
    });
  }, [
    mode,
    presetId,
    folderNames,
    mappings,
    specialDirs,
    copyFiles,
    copyExtras,
    includeText,
    dryRun,
    reverseRenameOrder,
    renamePattern,
    startIndex,
    padding,
  ]);

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

  const addMapping = () => {
    const from = mappingDraft.from.trim();
    const to = mappingDraft.to.trim();
    if (!from || !to || mappingDraftDuplicate) return;

    setMappings((current) => sortMappings([...current, { from, to }]));
    setMappingDraft({ from: "", to: "图包" });
  };

  const removeMapping = (index: number) => {
    setMappings((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const addSpecialDirs = () => {
    const incoming = splitNames(specialInput);
    if (!incoming.length) return;

    setSpecialDirs((current) => {
      const existing = new Set(current.map(normalizeKey));
      const next = [...current];

      for (const name of incoming) {
        const key = normalizeKey(name);
        if (!key || existing.has(key)) continue;
        existing.add(key);
        next.push(name);
      }

      return next.sort(compareText);
    });
    setSpecialInput("");
  };

  const removeSpecialDir = (name: string) => {
    setSpecialDirs((current) => current.filter((item) => normalizeKey(item) !== normalizeKey(name)));
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
          specialDirs,
          copyFiles,
          copyExtras,
          renamePattern,
          startIndex: Math.max(1, Number(startIndex) || 1),
          padding: Math.min(8, Math.max(1, Number(padding) || 3)),
          dryRun,
          includeText,
          reverseRenameOrder,
        },
      });
      setReport(result);
      setActiveTab("log");
    } catch (processError) {
      setError(processError instanceof Error ? processError.message : String(processError));
      setActiveTab("log");
    } finally {
      setIsProcessing(false);
    }
  };

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
            {copyFiles.length > 0 && (
              <button className="mini-action" type="button" onClick={() => setCopyFiles([])}>
                清空
              </button>
            )}
          </div>
          <button className="ghost-action" type="button" onClick={chooseCopyFiles}>
            <FilePlus size={16} />
            选择图片或 TXT
          </button>
          <div className="compact-list">
            {copyFiles.slice(0, 6).map((path) => (
              <div className="copy-chip" key={path} title={path}>
                <span>{shortName(path)}</span>
                <button
                  type="button"
                  title="移除"
                  onClick={() => setCopyFiles((current) => current.filter((item) => item !== path))}
                >
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
          onClick={runProcess}
          title={hasMappingDuplicates ? "请先处理重复映射" : dryRun ? "生成预览" : "开始处理"}
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
            <span>{dryRun ? "预览" : "执行"}</span>
            {reverseRenameOrder && <span>倒序</span>}
          </div>
        </header>

        <nav className="tabbar" aria-label="规则标签">
          <button
            className={activeTab === "rules" ? "active" : ""}
            type="button"
            onClick={() => setActiveTab("rules")}
          >
            <Settings size={16} />
            命名
          </button>
          <button
            className={activeTab === "mapping" ? "active" : ""}
            type="button"
            onClick={() => setActiveTab("mapping")}
          >
            <ListChecks size={16} />
            映射
          </button>
          <button
            className={activeTab === "special" ? "active" : ""}
            type="button"
            onClick={() => setActiveTab("special")}
          >
            <AlertTriangle size={16} />
            特殊目录
          </button>
          <button
            className={activeTab === "log" ? "active" : ""}
            type="button"
            onClick={() => setActiveTab("log")}
          >
            <Info size={16} />
            日志
          </button>
        </nav>

        <div className="tab-content">
          {activeTab === "rules" && (
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
                  <input
                    value={renamePattern}
                    onChange={(event) => setRenamePattern(event.target.value)}
                  />
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
                  <input
                    checked={dryRun}
                    type="checkbox"
                    onChange={(event) => setDryRun(event.target.checked)}
                  />
                  <span>预览模式</span>
                </label>
                <label className="check-row">
                  <input
                    checked={reverseRenameOrder}
                    type="checkbox"
                    onChange={(event) => setReverseRenameOrder(event.target.checked)}
                  />
                  <span>
                    <ArrowDownUp size={14} />
                    倒序重命名
                  </span>
                </label>
              </div>
            </section>
          )}

          {activeTab === "mapping" && (
            <section className="panel mapping-panel">
              <div className="panel-heading">
                <div>
                  <ListChecks size={18} />
                  <h3>目录映射</h3>
                </div>
                {hasMappingDuplicates && (
                  <span className="panel-badge warning">发现重复</span>
                )}
              </div>

              <div className="toolbar-grid mapping-tools">
                <label className="search-field">
                  <Search size={15} />
                  <input
                    value={mappingQuery}
                    placeholder="搜索映射"
                    onChange={(event) => setMappingQuery(event.target.value)}
                  />
                </label>
                <input
                  value={mappingDraft.from}
                  placeholder="原目录"
                  onChange={(event) =>
                    setMappingDraft((current) => ({ ...current, from: event.target.value }))
                  }
                />
                <input
                  value={mappingDraft.to}
                  placeholder="目标目录"
                  onChange={(event) =>
                    setMappingDraft((current) => ({ ...current, to: event.target.value }))
                  }
                />
                <button
                  className="icon-text-button"
                  type="button"
                  disabled={!mappingDraft.from.trim() || !mappingDraft.to.trim() || mappingDraftDuplicate}
                  onClick={addMapping}
                >
                  <Plus size={16} />
                  添加
                </button>
              </div>

              {mappingDraftDuplicate && <div className="inline-note">这个原目录已经存在。</div>}

              <div className="mapping-list">
                {mappingRows.map(({ mapping, index }) => {
                  const duplicate = duplicateMappingKeys.has(normalizeKey(mapping.from));
                  return (
                    <div className={`mapping-row ${duplicate ? "duplicate" : ""}`} key={`${mapping.from}-${index}`}>
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
                  );
                })}
                {!mappingRows.length && <div className="empty-log">没有匹配项</div>}
              </div>
            </section>
          )}

          {activeTab === "special" && (
            <section className="panel special-panel">
              <div className="panel-heading">
                <div>
                  <AlertTriangle size={18} />
                  <h3>特殊目录</h3>
                </div>
                <span className="panel-badge">{specialDirs.length} 个</span>
              </div>

              <div className="toolbar-grid special-tools">
                <label className="search-field">
                  <Search size={15} />
                  <input
                    value={specialQuery}
                    placeholder="搜索特殊目录"
                    onChange={(event) => setSpecialQuery(event.target.value)}
                  />
                </label>
                <input
                  value={specialInput}
                  placeholder="目录名"
                  onChange={(event) => setSpecialInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addSpecialDirs();
                    }
                  }}
                />
                <button
                  className="icon-text-button"
                  type="button"
                  disabled={!specialInput.trim()}
                  onClick={addSpecialDirs}
                >
                  <Plus size={16} />
                  添加
                </button>
              </div>

              <div className="tag-list">
                {specialRows.map((name) => (
                  <div className="tag-row" key={name}>
                    <span>{name}</span>
                    <button type="button" title="移除" onClick={() => removeSpecialDir(name)}>
                      <X size={14} />
                    </button>
                  </div>
                ))}
                {!specialRows.length && <div className="empty-log">没有匹配项</div>}
              </div>
            </section>
          )}

          {activeTab === "log" && (
            <section className="panel report-panel">
              <div className="panel-heading">
                <div>
                  <Info size={18} />
                  <h3>处理结果</h3>
                </div>
              </div>

              {error && (
                <div className="error-box">
                  <AlertTriangle size={17} />
                  {error}
                </div>
              )}

              {report && (
                <>
                  <div className="result-line">
                    已处理 {report.rootsProcessed} 个目录，移动 {report.filesMoved} 个文件，重命名{" "}
                    {report.filesRenamed} 个文件。
                  </div>
                  <div className="stats-grid">
                    <span>创建 {report.foldersCreated}</span>
                    <span>映射 {report.foldersRenamed}</span>
                    <span>复制 {report.filesCopied}</span>
                    <span>跳过 {report.skipped}</span>
                  </div>
                </>
              )}

              <div className="log-list">
                {latestEntries.map((entry, index) => (
                  <div className={`log-row ${entry.level}`} key={`${entry.message}-${index}`}>
                    {entry.level === "success" ? (
                      <CheckCircle size={15} />
                    ) : entry.level === "warn" ? (
                      <AlertTriangle size={15} />
                    ) : (
                      <Info size={15} />
                    )}
                    <div>
                      <strong>{entry.message}</strong>
                      {entry.path && <span title={entry.path}>{shortName(entry.path)}</span>}
                    </div>
                  </div>
                ))}
                {!latestEntries.length && <div className="empty-log">等待任务</div>}
              </div>
            </section>
          )}
        </div>
      </section>
    </main>
  );
}

export default App;
