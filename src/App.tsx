import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { Tabbar } from "./components/Tabbar";
import { Topbar } from "./components/Topbar";
import { MappingPanel } from "./components/panels/MappingPanel";
import { ReportPanel } from "./components/panels/ReportPanel";
import { RulesPanel } from "./components/panels/RulesPanel";
import { SpecialPanel } from "./components/panels/SpecialPanel";
import {
  copyableExtensions,
  defaultFolderNames,
  defaultRenamePattern,
  defaultSpecialDirs,
  folderPresets,
} from "./config";
import { useTauriDragDrop } from "./hooks/useTauriDragDrop";
import { useWindowStatePersistence } from "./hooks/useWindowStatePersistence";
import { readPersistedSettings, writePersistedSettings } from "./storage";
import type { DirectoryMapping, FolderNames, Mode, ProcessReport, RuleTab } from "./types";
import {
  cleanMappings,
  cleanStringArray,
  compareText,
  findDuplicateMappingKeys,
  isFolderNames,
  isMode,
  normalizeKey,
  normalizeSelection,
  sortMappings,
  splitNames,
  uniqueMerge,
} from "./utils";
import "./App.css";

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
  const [closeToTray, setCloseToTray] = useState(() => savedSettings.closeToTray === true);
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
        return fromCompare === 0 ? compareText(left.mapping.to, right.mapping.to) : fromCompare;
      });
  }, [mappingQuery, mappings]);

  const specialRows = useMemo(() => {
    const query = normalizeKey(specialQuery);
    return specialDirs.filter((name) => !query || normalizeKey(name).includes(query)).sort(compareText);
  }, [specialDirs, specialQuery]);

  const mappingDraftDuplicate = useMemo(
    () =>
      Boolean(mappingDraft.from.trim()) &&
      mappings.some((mapping) => normalizeKey(mapping.from) === normalizeKey(mappingDraft.from)),
    [mappingDraft.from, mappings],
  );

  const visibleLogEntries = report?.entries.slice(-120) ?? [];
  const hiddenLogCount = Math.max((report?.entries.length ?? 0) - visibleLogEntries.length, 0);

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
      closeToTray,
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
    closeToTray,
    renamePattern,
    startIndex,
    padding,
  ]);

  useEffect(() => {
    invoke("set_close_to_tray_enabled", { enabled: closeToTray }).catch(() => undefined);
  }, [closeToTray]);

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

  useTauriDragDrop(addRoots);
  useWindowStatePersistence();

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

  const clearRoots = () => {
    setRoots([]);
    setReport(null);
    setError(null);
  };

  const removeRoot = (path: string) => {
    setRoots((current) => current.filter((item) => item !== path));
  };

  const removeCopyFile = (path: string) => {
    setCopyFiles((current) => current.filter((item) => item !== path));
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
      <Sidebar
        mode={mode}
        activeRoots={activeRoots}
        copyFiles={copyFiles}
        canProcess={canProcess}
        isProcessing={isProcessing}
        dryRun={dryRun}
        hasMappingDuplicates={hasMappingDuplicates}
        onModeChange={setMode}
        onChooseRoots={chooseRoots}
        onClearRoots={clearRoots}
        onRemoveRoot={removeRoot}
        onChooseCopyFiles={chooseCopyFiles}
        onClearCopyFiles={() => setCopyFiles([])}
        onRemoveCopyFile={removeCopyFile}
        onRunProcess={runProcess}
      />

      <section className="workspace">
        <Topbar
          rootCount={activeRoots.length}
          copyFileCount={copyFiles.length}
          dryRun={dryRun}
          reverseRenameOrder={reverseRenameOrder}
          closeToTray={closeToTray}
        />

        <Tabbar activeTab={activeTab} onTabChange={setActiveTab} />

        <div className="tab-content">
          {activeTab === "rules" && (
            <RulesPanel
              presetId={presetId}
              folderNames={folderNames}
              renamePattern={renamePattern}
              startIndex={startIndex}
              padding={padding}
              copyExtras={copyExtras}
              includeText={includeText}
              dryRun={dryRun}
              reverseRenameOrder={reverseRenameOrder}
              closeToTray={closeToTray}
              onApplyPreset={applyPreset}
              onFolderNameChange={updateFolderName}
              onRenamePatternChange={setRenamePattern}
              onStartIndexChange={setStartIndex}
              onPaddingChange={setPadding}
              onCopyExtrasChange={setCopyExtras}
              onIncludeTextChange={setIncludeText}
              onDryRunChange={setDryRun}
              onReverseRenameOrderChange={setReverseRenameOrder}
              onCloseToTrayChange={setCloseToTray}
            />
          )}

          {activeTab === "mapping" && (
            <MappingPanel
              rows={mappingRows}
              query={mappingQuery}
              draft={mappingDraft}
              duplicateKeys={duplicateMappingKeys}
              hasDuplicates={hasMappingDuplicates}
              draftDuplicate={mappingDraftDuplicate}
              onQueryChange={setMappingQuery}
              onDraftChange={setMappingDraft}
              onUpdateMapping={updateMapping}
              onAddMapping={addMapping}
              onRemoveMapping={removeMapping}
            />
          )}

          {activeTab === "special" && (
            <SpecialPanel
              rows={specialRows}
              totalCount={specialDirs.length}
              query={specialQuery}
              input={specialInput}
              onQueryChange={setSpecialQuery}
              onInputChange={setSpecialInput}
              onAddSpecialDirs={addSpecialDirs}
              onRemoveSpecialDir={removeSpecialDir}
            />
          )}

          {activeTab === "log" && (
            <ReportPanel
              report={report}
              error={error}
              entries={visibleLogEntries}
              hiddenLogCount={hiddenLogCount}
            />
          )}
        </div>
      </section>
    </main>
  );
}

export default App;
