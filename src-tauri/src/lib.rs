use serde::{Deserialize, Serialize};
use std::{
    collections::{HashMap, HashSet},
    fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProcessRequest {
    roots: Vec<String>,
    folder_names: FolderNames,
    mappings: Vec<DirectoryMapping>,
    special_dirs: Vec<String>,
    copy_files: Vec<String>,
    copy_extras: bool,
    rename_pattern: String,
    start_index: u32,
    padding: usize,
    dry_run: bool,
    include_text: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FolderNames {
    images: String,
    videos: String,
    gifs: String,
    texts: String,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct DirectoryMapping {
    from: String,
    to: String,
}

#[derive(Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProcessReport {
    roots_processed: usize,
    folders_created: usize,
    folders_renamed: usize,
    files_moved: usize,
    files_renamed: usize,
    files_copied: usize,
    skipped: usize,
    log_path: Option<String>,
    entries: Vec<LogEntry>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct LogEntry {
    level: String,
    message: String,
    path: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
enum Category {
    Images,
    Videos,
    Gifs,
    Texts,
}

#[tauri::command]
fn process_rename(request: ProcessRequest) -> Result<ProcessReport, String> {
    if request.roots.is_empty() {
        return Err("请先添加至少一个待处理文件夹。".to_string());
    }

    let mut report = ProcessReport::default();
    let special_dirs = normalize_names(&request.special_dirs);
    let mappings = request
        .mappings
        .iter()
        .filter(|mapping| !mapping.from.trim().is_empty() && !mapping.to.trim().is_empty())
        .cloned()
        .collect::<Vec<_>>();

    for root in request.roots.iter().map(PathBuf::from) {
        if !root.exists() {
            report.warn("路径不存在，已跳过。", Some(&root));
            report.skipped += 1;
            continue;
        }

        if !root.is_dir() {
            report.warn("这不是文件夹，已跳过。", Some(&root));
            report.skipped += 1;
            continue;
        }

        process_root(&root, &request, &mappings, &special_dirs, &mut report)?;
        report.roots_processed += 1;
    }

    if report.roots_processed == 0 {
        return Err("没有可处理的文件夹。".to_string());
    }

    report.log_path = write_log_file(&request, &report)?;
    Ok(report)
}

fn process_root(
    root: &Path,
    request: &ProcessRequest,
    mappings: &[DirectoryMapping],
    special_dirs: &HashSet<String>,
    report: &mut ProcessReport,
) -> Result<(), String> {
    let root_name = root
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_else(|| "folder".to_string());

    report.info("开始处理文件夹。", Some(root));
    apply_directory_mappings(root, mappings, request.dry_run, report)?;

    let mut loose_files: HashMap<Category, Vec<PathBuf>> = HashMap::new();
    let mut special_directories = Vec::new();

    for entry in read_dir_sorted(root)? {
        let path = entry.path();
        if path.is_dir() {
            let name = entry.file_name().to_string_lossy().to_string();
            if special_dirs.contains(&normalize_name(&name)) {
                special_directories.push(path);
            }
            continue;
        }

        if path.is_file() {
            if is_tool_log(&path) {
                continue;
            }

            if let Some(category) = category_for_path(&path, request.include_text) {
                loose_files.entry(category).or_default().push(path);
            } else {
                report.warn("未识别的文件类型，保留在原位置。", Some(&path));
                report.skipped += 1;
            }
        }
    }

    for directory in special_directories {
        let category_name = directory
            .file_name()
            .map(|name| name.to_string_lossy().to_string())
            .unwrap_or_else(|| "special".to_string());

        report.info("特殊目录：只重命名，不移动。", Some(&directory));
        rename_files_in_place(
            &directory,
            &root_name,
            &category_name,
            None,
            request,
            report,
        )?;
    }

    for category in [
        Category::Images,
        Category::Videos,
        Category::Gifs,
        Category::Texts,
    ] {
        if category == Category::Texts && !request.include_text {
            continue;
        }

        let category_name = category_folder_name(category, &request.folder_names);
        let target_dir = root.join(category_name);
        let files_to_move = loose_files.remove(&category).unwrap_or_default();

        if !files_to_move.is_empty() {
            ensure_dir(&target_dir, request.dry_run, report)?;

            for file in files_to_move {
                let file_name = file
                    .file_name()
                    .map(|name| name.to_os_string())
                    .ok_or_else(|| format!("无法读取文件名：{}", file.display()))?;
                let destination = unique_path(&target_dir.join(file_name));

                if request.dry_run {
                    report.info("预览：将移动文件。", Some(&file));
                } else {
                    fs::rename(&file, &destination).map_err(|error| {
                        format!(
                            "移动文件失败：{} -> {} ({error})",
                            file.display(),
                            destination.display()
                        )
                    })?;
                }

                report.files_moved += 1;
                report.success("已移动到分类目录。", Some(&destination));
            }
        }

        if target_dir.exists() || !files_to_move_count(&target_dir).is_zero() {
            rename_files_in_place(
                &target_dir,
                &root_name,
                category_name,
                Some(category),
                request,
                report,
            )?;
        }
    }

    if request.copy_extras && !request.copy_files.is_empty() {
        copy_extra_files(root, request, report)?;
    }

    report.success("文件夹处理完成。", Some(root));
    Ok(())
}

fn apply_directory_mappings(
    root: &Path,
    mappings: &[DirectoryMapping],
    dry_run: bool,
    report: &mut ProcessReport,
) -> Result<(), String> {
    if mappings.is_empty() {
        return Ok(());
    }

    for entry in read_dir_sorted(root)? {
        let source = entry.path();
        if !source.is_dir() {
            continue;
        }

        let source_name = entry.file_name().to_string_lossy().to_string();
        let Some(mapping) = mappings
            .iter()
            .find(|mapping| normalize_name(&mapping.from) == normalize_name(&source_name))
        else {
            continue;
        };

        let target = root.join(mapping.to.trim());
        if normalize_name(&source_name) == normalize_name(mapping.to.trim()) {
            continue;
        }

        if dry_run {
            report.info("预览：将按目录映射重命名。", Some(&source));
            report.folders_renamed += 1;
            continue;
        }

        if target.exists() {
            merge_directory_contents(&source, &target, report)?;
            remove_dir_if_empty(&source, report)?;
        } else {
            fs::rename(&source, &target).map_err(|error| {
                format!(
                    "目录映射失败：{} -> {} ({error})",
                    source.display(),
                    target.display()
                )
            })?;
        }

        report.folders_renamed += 1;
        report.success("已按映射处理目录。", Some(&target));
    }

    Ok(())
}

fn merge_directory_contents(
    source: &Path,
    target: &Path,
    report: &mut ProcessReport,
) -> Result<(), String> {
    ensure_dir(target, false, report)?;

    for entry in read_dir_sorted(source)? {
        let from = entry.path();
        let to = unique_path(&target.join(entry.file_name()));
        fs::rename(&from, &to).map_err(|error| {
            format!(
                "合并目录失败：{} -> {} ({error})",
                from.display(),
                to.display()
            )
        })?;
        report.success("已合并映射目录内容。", Some(&to));
    }

    Ok(())
}

fn remove_dir_if_empty(path: &Path, report: &mut ProcessReport) -> Result<(), String> {
    if read_dir_sorted(path)?.is_empty() {
        fs::remove_dir(path)
            .map_err(|error| format!("删除空目录失败：{} ({error})", path.display()))?;
        report.info("已移除合并后的空目录。", Some(path));
    }

    Ok(())
}

fn rename_files_in_place(
    directory: &Path,
    root_name: &str,
    category_name: &str,
    category_filter: Option<Category>,
    request: &ProcessRequest,
    report: &mut ProcessReport,
) -> Result<(), String> {
    if !directory.exists() {
        return Ok(());
    }

    let mut files = Vec::new();
    collect_files(directory, &mut files)?;
    files.sort();

    let mut index = request.start_index;
    for file in files {
        if is_tool_log(&file) {
            continue;
        }

        if let Some(category) = category_filter {
            if category_for_path(&file, request.include_text) != Some(category) {
                continue;
            }
        }

        let extension = file
            .extension()
            .map(|ext| ext.to_string_lossy().to_string())
            .unwrap_or_default();
        let next_name = build_file_name(
            &request.rename_pattern,
            root_name,
            category_name,
            index,
            request.padding,
            &extension,
        );
        let intended_target = file.with_file_name(next_name);

        index += 1;

        if file == intended_target {
            report.info("文件名已符合规则。", Some(&file));
            continue;
        }

        let target = unique_path(&intended_target);

        if request.dry_run {
            report.info("预览：将重命名文件。", Some(&file));
        } else {
            fs::rename(&file, &target).map_err(|error| {
                format!(
                    "重命名失败：{} -> {} ({error})",
                    file.display(),
                    target.display()
                )
            })?;
        }

        report.files_renamed += 1;
        report.success("已重命名文件。", Some(&target));
    }

    Ok(())
}

fn copy_extra_files(
    root: &Path,
    request: &ProcessRequest,
    report: &mut ProcessReport,
) -> Result<(), String> {
    for source in request.copy_files.iter().map(PathBuf::from) {
        if !source.exists() || !source.is_file() {
            report.warn("补充文件不存在或不是文件，已跳过。", Some(&source));
            report.skipped += 1;
            continue;
        }

        if !is_copyable_extra(&source) {
            report.warn("补充文件仅支持图片、GIF 和 TXT，已跳过。", Some(&source));
            report.skipped += 1;
            continue;
        }

        let file_name = source
            .file_name()
            .ok_or_else(|| format!("无法读取补充文件名：{}", source.display()))?;
        let destination = unique_path(&root.join(file_name));

        if request.dry_run {
            report.info("预览：将复制补充文件。", Some(&source));
        } else {
            fs::copy(&source, &destination).map_err(|error| {
                format!(
                    "复制补充文件失败：{} -> {} ({error})",
                    source.display(),
                    destination.display()
                )
            })?;
        }

        report.files_copied += 1;
        report.success("已复制补充文件到根目录。", Some(&destination));
    }

    Ok(())
}

fn ensure_dir(path: &Path, dry_run: bool, report: &mut ProcessReport) -> Result<(), String> {
    if path.exists() {
        return Ok(());
    }

    if dry_run {
        report.info("预览：将创建分类目录。", Some(path));
    } else {
        fs::create_dir_all(path)
            .map_err(|error| format!("创建目录失败：{} ({error})", path.display()))?;
    }

    report.folders_created += 1;
    report.success("已创建目录。", Some(path));
    Ok(())
}

fn collect_files(directory: &Path, output: &mut Vec<PathBuf>) -> Result<(), String> {
    for entry in read_dir_sorted(directory)? {
        let path = entry.path();
        if path.is_dir() {
            collect_files(&path, output)?;
        } else if path.is_file() {
            output.push(path);
        }
    }

    Ok(())
}

fn read_dir_sorted(path: &Path) -> Result<Vec<fs::DirEntry>, String> {
    let mut entries = fs::read_dir(path)
        .map_err(|error| format!("读取目录失败：{} ({error})", path.display()))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("读取目录项失败：{} ({error})", path.display()))?;

    entries.sort_by_key(|entry| entry.path());
    Ok(entries)
}

fn category_for_path(path: &Path, include_text: bool) -> Option<Category> {
    let ext = path.extension()?.to_string_lossy().to_lowercase();
    match ext.as_str() {
        "gif" => Some(Category::Gifs),
        "jpg" | "jpeg" | "png" | "webp" | "bmp" | "tif" | "tiff" | "avif" | "heic" | "heif" => {
            Some(Category::Images)
        }
        "mp4" | "mov" | "mkv" | "avi" | "wmv" | "m4v" | "webm" | "flv" | "ts" | "m2ts" => {
            Some(Category::Videos)
        }
        "txt" | "md" | "nfo" if include_text => Some(Category::Texts),
        _ => None,
    }
}

fn is_copyable_extra(path: &Path) -> bool {
    matches!(
        path.extension()
            .map(|ext| ext.to_string_lossy().to_lowercase())
            .as_deref(),
        Some(
            "jpg"
                | "jpeg"
                | "png"
                | "webp"
                | "bmp"
                | "tif"
                | "tiff"
                | "avif"
                | "heic"
                | "heif"
                | "gif"
                | "txt"
        )
    )
}

fn category_folder_name<'a>(category: Category, folder_names: &'a FolderNames) -> &'a str {
    let value = match category {
        Category::Images => folder_names.images.trim(),
        Category::Videos => folder_names.videos.trim(),
        Category::Gifs => folder_names.gifs.trim(),
        Category::Texts => folder_names.texts.trim(),
    };

    if !value.is_empty() {
        return value;
    }

    match category {
        Category::Images => "图包",
        Category::Videos => "视频",
        Category::Gifs => "GIF",
        Category::Texts => "文本",
    }
}

fn build_file_name(
    pattern: &str,
    root_name: &str,
    category_name: &str,
    index: u32,
    padding: usize,
    extension: &str,
) -> String {
    let padded_index = format!("{index:0padding$}");
    let base_pattern = if pattern.trim().is_empty() {
        "{folder}_{category}_{index}"
    } else {
        pattern.trim()
    };

    let stem = base_pattern
        .replace("{folder}", root_name)
        .replace("{category}", category_name)
        .replace("{index}", &padded_index);
    let sanitized_stem = sanitize_file_name(&stem);

    if extension.is_empty() {
        sanitized_stem
    } else {
        format!("{sanitized_stem}.{}", sanitize_extension(extension))
    }
}

fn sanitize_file_name(name: &str) -> String {
    let cleaned = name
        .chars()
        .map(|character| match character {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '_',
            character if character.is_control() => '_',
            character => character,
        })
        .collect::<String>();
    let trimmed = cleaned.trim().trim_matches('.').to_string();

    if trimmed.is_empty() {
        "renamed".to_string()
    } else {
        trimmed
    }
}

fn sanitize_extension(extension: &str) -> String {
    extension
        .chars()
        .filter(|character| character.is_ascii_alphanumeric())
        .collect::<String>()
}

fn unique_path(path: &Path) -> PathBuf {
    if !path.exists() {
        return path.to_path_buf();
    }

    let parent = path.parent().unwrap_or_else(|| Path::new(""));
    let stem = path
        .file_stem()
        .map(|stem| stem.to_string_lossy().to_string())
        .unwrap_or_else(|| "file".to_string());
    let extension = path
        .extension()
        .map(|ext| ext.to_string_lossy().to_string());

    for copy_index in 2..10_000 {
        let candidate_name = match &extension {
            Some(extension) if !extension.is_empty() => format!("{stem}-{copy_index}.{extension}"),
            _ => format!("{stem}-{copy_index}"),
        };
        let candidate = parent.join(candidate_name);
        if !candidate.exists() {
            return candidate;
        }
    }

    path.to_path_buf()
}

fn normalize_names(names: &[String]) -> HashSet<String> {
    names
        .iter()
        .map(|name| normalize_name(name))
        .filter(|name| !name.is_empty())
        .collect()
}

fn normalize_name(name: &str) -> String {
    name.trim().to_lowercase()
}

fn is_tool_log(path: &Path) -> bool {
    path.file_name()
        .map(|name| name.to_string_lossy().starts_with("RenameStudio_"))
        .unwrap_or(false)
}

fn files_to_move_count(path: &Path) -> usize {
    if !path.exists() || !path.is_dir() {
        return 0;
    }

    fs::read_dir(path)
        .map(|entries| {
            entries
                .filter_map(Result::ok)
                .filter(|entry| entry.path().is_file())
                .count()
        })
        .unwrap_or(0)
}

fn write_log_file(
    request: &ProcessRequest,
    report: &ProcessReport,
) -> Result<Option<String>, String> {
    if request.dry_run {
        return Ok(None);
    }

    let Some(first_root) = request
        .roots
        .iter()
        .map(PathBuf::from)
        .find(|path| path.is_dir())
    else {
        return Ok(None);
    };

    let seconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("生成日志时间失败：{error}"))?
        .as_secs();
    let log_path = first_root.join(format!("RenameStudio_{seconds}.log"));
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

trait ZeroCheck {
    fn is_zero(&self) -> bool;
}

impl ZeroCheck for usize {
    fn is_zero(&self) -> bool {
        *self == 0
    }
}

impl ProcessReport {
    fn info(&mut self, message: &str, path: Option<&Path>) {
        self.push("info", message, path);
    }

    fn success(&mut self, message: &str, path: Option<&Path>) {
        self.push("success", message, path);
    }

    fn warn(&mut self, message: &str, path: Option<&Path>) {
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![process_rename])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
