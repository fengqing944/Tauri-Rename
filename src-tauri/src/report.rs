use std::{
    fs,
    path::Path,
    time::{SystemTime, UNIX_EPOCH},
};

use serde::Serialize;
use tauri::Manager;

#[derive(Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProcessReport {
    pub(crate) roots_processed: usize,
    pub(crate) folders_created: usize,
    pub(crate) folders_renamed: usize,
    pub(crate) files_moved: usize,
    pub(crate) files_renamed: usize,
    pub(crate) files_copied: usize,
    pub(crate) skipped: usize,
    pub(crate) log_path: Option<String>,
    pub(crate) entries: Vec<LogEntry>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct LogEntry {
    level: String,
    message: String,
    path: Option<String>,
}

impl ProcessReport {
    pub(crate) fn info(&mut self, message: &str, path: Option<&Path>) {
        self.push("info", message, path);
    }

    pub(crate) fn success(&mut self, message: &str, path: Option<&Path>) {
        self.push("success", message, path);
    }

    pub(crate) fn warn(&mut self, message: &str, path: Option<&Path>) {
        self.push("warn", message, path);
    }

    fn push(&mut self, level: &str, message: &str, path: Option<&Path>) {
        self.entries.push(LogEntry {
            level: level.to_string(),
            message: message.to_string(),
            path: path.map(|path| path.display().to_string()),
        });
    }
}

pub(crate) fn write_log_file(
    app: &tauri::AppHandle,
    dry_run: bool,
    report: &ProcessReport,
) -> Result<Option<String>, String> {
    if dry_run {
        return Ok(None);
    }

    let log_dir = app
        .path()
        .app_log_dir()
        .or_else(|_| app.path().app_data_dir())
        .map_err(|error| format!("获取应用日志目录失败：{error}"))?;

    fs::create_dir_all(&log_dir)
        .map_err(|error| format!("创建应用日志目录失败：{} ({error})", log_dir.display()))?;

    let seconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("生成日志时间失败：{error}"))?
        .as_secs();
    let log_path = log_dir.join(format!("RenameStudio_{seconds}.log"));
    let mut lines = Vec::new();

    lines.push("Rename Studio 日志".to_string());
    lines.push(format!("处理文件夹：{}", report.roots_processed));
    lines.push(format!("创建目录：{}", report.folders_created));
    lines.push(format!("映射目录：{}", report.folders_renamed));
    lines.push(format!("移动文件：{}", report.files_moved));
    lines.push(format!("重命名文件：{}", report.files_renamed));
    lines.push(format!("复制补充文件：{}", report.files_copied));
    lines.push(format!("跳过：{}", report.skipped));
    lines.push(String::new());

    for entry in &report.entries {
        match &entry.path {
            Some(path) => lines.push(format!("[{}] {} - {}", entry.level, entry.message, path)),
            None => lines.push(format!("[{}] {}", entry.level, entry.message)),
        }
    }

    fs::write(&log_path, lines.join("\n"))
        .map_err(|error| format!("写入日志失败：{} ({error})", log_path.display()))?;

    Ok(Some(log_path.display().to_string()))
}
