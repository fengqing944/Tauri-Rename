import { FolderOpen, Image } from "lucide-react";
import type { ProcessingMode } from "../types";

type TopbarProps = {
  rootCount: number;
  copyFileCount: number;
  dryRun: boolean;
  reverseRenameOrder: boolean;
  closeToTray: boolean;
  processingMode: ProcessingMode;
};

export function Topbar({
  rootCount,
  copyFileCount,
  dryRun,
  reverseRenameOrder,
  closeToTray,
  processingMode,
}: TopbarProps) {
  return (
    <header className="topbar">
      <div>
        <span className="eyebrow">规则面板</span>
        <h2>分类、映射、重命名</h2>
      </div>
      <div className="status-strip">
        <span>
          <FolderOpen size={14} />
          {rootCount} 个目录
        </span>
        <span>
          <Image size={14} />
          {copyFileCount} 个补充文件
        </span>
        <span>{processingMode === "renameOnly" ? "只重命名" : "标准整理"}</span>
        <span>{dryRun ? "预览" : "执行"}</span>
        {reverseRenameOrder && <span>倒序</span>}
        {closeToTray && <span>托盘</span>}
      </div>
    </header>
  );
}
