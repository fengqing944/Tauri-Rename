import { AlertTriangle, Plus, Search, X } from "lucide-react";

type SpecialPanelProps = {
  rows: string[];
  totalCount: number;
  query: string;
  input: string;
  onQueryChange: (value: string) => void;
  onInputChange: (value: string) => void;
  onAddSpecialDirs: () => void;
  onRemoveSpecialDir: (name: string) => void;
};

export function SpecialPanel({
  rows,
  totalCount,
  query,
  input,
  onQueryChange,
  onInputChange,
  onAddSpecialDirs,
  onRemoveSpecialDir,
}: SpecialPanelProps) {
  return (
    <section className="panel special-panel">
      <div className="panel-heading">
        <div>
          <AlertTriangle size={18} />
          <h3>特殊目录</h3>
        </div>
        <span className="panel-badge">{totalCount} 个</span>
      </div>

      <div className="toolbar-grid special-tools">
        <label className="search-field">
          <Search size={15} />
          <input
            value={query}
            placeholder="搜索特殊目录"
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </label>
        <input
          value={input}
          placeholder="目录名"
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onAddSpecialDirs();
            }
          }}
        />
        <button
          className="icon-text-button"
          type="button"
          disabled={!input.trim()}
          onClick={onAddSpecialDirs}
        >
          <Plus size={16} />
          添加
        </button>
      </div>

      <div className="tag-list">
        {rows.map((name) => (
          <div className="tag-row" key={name}>
            <span>{name}</span>
            <button type="button" title="移除" onClick={() => onRemoveSpecialDir(name)}>
              <X size={14} />
            </button>
          </div>
        ))}
        {!rows.length && <div className="empty-log">没有匹配项</div>}
      </div>
    </section>
  );
}
