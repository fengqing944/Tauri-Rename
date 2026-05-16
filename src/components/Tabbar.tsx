import { AlertTriangle, Info, ListChecks, Settings } from "lucide-react";
import type { RuleTab } from "../types";

type TabbarProps = {
  activeTab: RuleTab;
  onTabChange: (tab: RuleTab) => void;
};

export function Tabbar({ activeTab, onTabChange }: TabbarProps) {
  return (
    <nav className="tabbar" aria-label="规则标签">
      <button
        className={activeTab === "rules" ? "active" : ""}
        type="button"
        onClick={() => onTabChange("rules")}
      >
        <Settings size={16} />
        命名
      </button>
      <button
        className={activeTab === "mapping" ? "active" : ""}
        type="button"
        onClick={() => onTabChange("mapping")}
      >
        <ListChecks size={16} />
        映射
      </button>
      <button
        className={activeTab === "special" ? "active" : ""}
        type="button"
        onClick={() => onTabChange("special")}
      >
        <AlertTriangle size={16} />
        特殊目录
      </button>
      <button
        className={activeTab === "log" ? "active" : ""}
        type="button"
        onClick={() => onTabChange("log")}
      >
        <Info size={16} />
        日志
      </button>
    </nav>
  );
}
