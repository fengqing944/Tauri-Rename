import { ListChecks, Minus, Plus, Search } from "lucide-react";
import type { DirectoryMapping } from "../../types";
import { normalizeKey } from "../../utils";

type MappingPanelProps = {
  rows: { mapping: DirectoryMapping; index: number }[];
  query: string;
  draft: DirectoryMapping;
  duplicateKeys: Set<string>;
  hasDuplicates: boolean;
  draftDuplicate: boolean;
  onQueryChange: (value: string) => void;
  onDraftChange: (mapping: DirectoryMapping) => void;
  onUpdateMapping: (index: number, key: keyof DirectoryMapping, value: string) => void;
  onAddMapping: () => void;
  onRemoveMapping: (index: number) => void;
};

export function MappingPanel({
  rows,
  query,
  draft,
  duplicateKeys,
  hasDuplicates,
  draftDuplicate,
  onQueryChange,
  onDraftChange,
  onUpdateMapping,
  onAddMapping,
  onRemoveMapping,
}: MappingPanelProps) {
  return (
    <section className="panel mapping-panel">
      <div className="panel-heading">
        <div>
          <ListChecks size={18} />
          <h3>目录映射</h3>
        </div>
        {hasDuplicates && <span className="panel-badge warning">发现重复</span>}
      </div>

      <div className="toolbar-grid mapping-tools">
        <label className="search-field">
          <Search size={15} />
          <input
            value={query}
            placeholder="搜索映射"
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </label>
        <input
          value={draft.from}
          placeholder="原目录"
          onChange={(event) => onDraftChange({ ...draft, from: event.target.value })}
        />
        <input
          value={draft.to}
          placeholder="目标目录"
          onChange={(event) => onDraftChange({ ...draft, to: event.target.value })}
        />
        <button
          className="icon-text-button"
          type="button"
          disabled={!draft.from.trim() || !draft.to.trim() || draftDuplicate}
          onClick={onAddMapping}
        >
          <Plus size={16} />
          添加
        </button>
      </div>

      {draftDuplicate && <div className="inline-note">这个原目录已经存在。</div>}

      <div className="mapping-list">
        {rows.map(({ mapping, index }) => {
          const duplicate = duplicateKeys.has(normalizeKey(mapping.from));
          return (
            <div
              className={`mapping-row ${duplicate ? "duplicate" : ""}`}
              key={`${mapping.from}-${index}`}
            >
              <input
                value={mapping.from}
                placeholder="Pic"
                onChange={(event) => onUpdateMapping(index, "from", event.target.value)}
              />
              <span>→</span>
              <input
                value={mapping.to}
                placeholder="图包"
                onChange={(event) => onUpdateMapping(index, "to", event.target.value)}
              />
              <button type="button" title="删除映射" onClick={() => onRemoveMapping(index)}>
                <Minus size={15} />
              </button>
            </div>
          );
        })}
        {!rows.length && <div className="empty-log">没有匹配项</div>}
      </div>
    </section>
  );
}
