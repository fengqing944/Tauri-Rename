import { ArrowDownUp, Settings } from "lucide-react";
import { folderPresets } from "../../config";
import type { FolderNames } from "../../types";

type RulesPanelProps = {
  presetId: string;
  folderNames: FolderNames;
  renamePattern: string;
  startIndex: number;
  padding: number;
  copyExtras: boolean;
  includeText: boolean;
  dryRun: boolean;
  reverseRenameOrder: boolean;
  closeToTray: boolean;
  onApplyPreset: (id: string) => void;
  onFolderNameChange: (key: keyof FolderNames, value: string) => void;
  onRenamePatternChange: (value: string) => void;
  onStartIndexChange: (value: number) => void;
  onPaddingChange: (value: number) => void;
  onCopyExtrasChange: (enabled: boolean) => void;
  onIncludeTextChange: (enabled: boolean) => void;
  onDryRunChange: (enabled: boolean) => void;
  onReverseRenameOrderChange: (enabled: boolean) => void;
  onCloseToTrayChange: (enabled: boolean) => void;
};

export function RulesPanel({
  presetId,
  folderNames,
  renamePattern,
  startIndex,
  padding,
  copyExtras,
  includeText,
  dryRun,
  reverseRenameOrder,
  closeToTray,
  onApplyPreset,
  onFolderNameChange,
  onRenamePatternChange,
  onStartIndexChange,
  onPaddingChange,
  onCopyExtrasChange,
  onIncludeTextChange,
  onDryRunChange,
  onReverseRenameOrderChange,
  onCloseToTrayChange,
}: RulesPanelProps) {
  return (
    <section className="panel rules-panel">
      <div className="panel-heading">
        <div>
          <Settings size={18} />
          <h3>命名规则</h3>
        </div>
        <select value={presetId} onChange={(event) => onApplyPreset(event.target.value)}>
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
            onChange={(event) => onFolderNameChange("images", event.target.value)}
          />
        </label>
        <label>
          视频目录
          <input
            value={folderNames.videos}
            onChange={(event) => onFolderNameChange("videos", event.target.value)}
          />
        </label>
        <label>
          GIF 目录
          <input
            value={folderNames.gifs}
            onChange={(event) => onFolderNameChange("gifs", event.target.value)}
          />
        </label>
        <label>
          文本目录
          <input
            value={folderNames.texts}
            onChange={(event) => onFolderNameChange("texts", event.target.value)}
          />
        </label>
      </div>

      <div className="pattern-row">
        <label>
          文件名模板
          <input
            value={renamePattern}
            onChange={(event) => onRenamePatternChange(event.target.value)}
          />
        </label>
        <label>
          起始
          <input
            min={1}
            type="number"
            value={startIndex}
            onChange={(event) => onStartIndexChange(Number(event.target.value))}
          />
        </label>
        <label>
          位数
          <input
            min={1}
            max={8}
            type="number"
            value={padding}
            onChange={(event) => onPaddingChange(Number(event.target.value))}
          />
        </label>
      </div>

      <div className="toggle-grid">
        <label className="check-row">
          <input
            checked={copyExtras}
            type="checkbox"
            onChange={(event) => onCopyExtrasChange(event.target.checked)}
          />
          <span>复制补充文件到根目录</span>
        </label>
        <label className="check-row">
          <input
            checked={includeText}
            type="checkbox"
            onChange={(event) => onIncludeTextChange(event.target.checked)}
          />
          <span>TXT 参与分类</span>
        </label>
        <label className="check-row">
          <input
            checked={dryRun}
            type="checkbox"
            onChange={(event) => onDryRunChange(event.target.checked)}
          />
          <span>预览模式</span>
        </label>
        <label className="check-row">
          <input
            checked={reverseRenameOrder}
            type="checkbox"
            onChange={(event) => onReverseRenameOrderChange(event.target.checked)}
          />
          <span>
            <ArrowDownUp size={14} />
            倒序重命名
          </span>
        </label>
        <label className="check-row">
          <input
            checked={closeToTray}
            type="checkbox"
            onChange={(event) => onCloseToTrayChange(event.target.checked)}
          />
          <span>关闭窗口时最小化到托盘</span>
        </label>
      </div>
    </section>
  );
}
