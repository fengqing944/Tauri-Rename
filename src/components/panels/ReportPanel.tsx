import { AlertTriangle, Info } from "lucide-react";
import type { LogEntry, ProcessReport } from "../../types";
import { shortName } from "../../utils";

type ReportPanelProps = {
  report: ProcessReport | null;
  error: string | null;
  entries: LogEntry[];
  hiddenLogCount: number;
};

function logStatus(level: LogEntry["level"]) {
  if (level === "success") return "完成";
  if (level === "warn") return "注意";
  return "信息";
}

export function ReportPanel({ report, error, entries, hiddenLogCount }: ReportPanelProps) {
  return (
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
          <div className="result-summary">
            <div className="result-copy">
              <span>本次结果</span>
              <strong>
                已处理 {report.rootsProcessed} 个目录，移动 {report.filesMoved} 个文件，重命名{" "}
                {report.filesRenamed} 个文件。
              </strong>
            </div>
            <div className="stats-grid">
              <span>创建 {report.foldersCreated}</span>
              <span>映射 {report.foldersRenamed}</span>
              <span>复制 {report.filesCopied}</span>
              <span>跳过 {report.skipped}</span>
            </div>
          </div>
          {report.logPath && (
            <div className="log-file-line" title={report.logPath}>
              <span>保存位置</span>
              <strong>{report.logPath}</strong>
            </div>
          )}
        </>
      )}

      <div className="log-section-title">
        <span>操作明细</span>
        {report && (
          <small>{hiddenLogCount > 0 ? `最近 ${entries.length} 条` : `${entries.length} 条`}</small>
        )}
      </div>

      <div className="log-list">
        {entries.map((entry, index) => (
          <div className={`log-row ${entry.level}`} key={`${entry.message}-${index}`}>
            <span className="log-status">{logStatus(entry.level)}</span>
            <div className="log-content">
              <strong>{entry.message}</strong>
              {entry.path && <span title={entry.path}>{shortName(entry.path)}</span>}
            </div>
          </div>
        ))}
        {!entries.length && <div className="empty-log">等待任务</div>}
      </div>
    </section>
  );
}
