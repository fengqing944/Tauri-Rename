use std::{
    collections::{HashMap, HashSet},
    fs,
    path::{Path, PathBuf},
};

use crate::{
    classification::{category_folder_name, category_for_path, is_copyable_extra},
    models::{Category, DirectoryMapping, ProcessRequest, RenameOperation},
    naming::{build_file_name, unique_path},
    report::{write_log_file, ProcessReport},
    sorting::{compare_paths_windows_like, read_dir_sorted},
};

#[tauri::command]
pub(crate) fn process_rename(
    app: tauri::AppHandle,
    request: ProcessRequest,
) -> Result<ProcessReport, String> {
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

    report.log_path = write_log_file(&app, request.dry_run, &report)?;
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
    let copy_file_names = copy_extra_file_names(request);

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

            if is_selected_copy_extra(&path, &copy_file_names) {
                report.info("补充文件保留在根目录。", Some(&path));
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

        if target_dir.exists() || files_to_move_count(&target_dir) > 0 {
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
    files.sort_by(|left, right| compare_paths_windows_like(left, right));
    if request.reverse_rename_order {
        files.reverse();
    }

    let mut operations = Vec::new();
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

        operations.push(RenameOperation {
            source: file,
            target: intended_target,
        });
    }

    if operations.is_empty() {
        return Ok(());
    }

    if request.dry_run {
        for operation in operations {
            report.files_renamed += 1;
            report.info("预览：将重命名文件。", Some(&operation.source));
        }
        return Ok(());
    }

    let mut staged = Vec::new();
    for (operation_index, operation) in operations.iter().enumerate() {
        let temp_path = unique_path(&operation.source.with_file_name(format!(
            ".rename-studio-tmp-{}-{operation_index}.tmp",
            std::process::id()
        )));

        fs::rename(&operation.source, &temp_path).map_err(|error| {
            format!(
                "重命名准备失败：{} -> {} ({error})",
                operation.source.display(),
                temp_path.display()
            )
        })?;

        staged.push((temp_path, operation.target.clone()));
    }

    for (temp_path, intended_target) in staged {
        let target = unique_path(&intended_target);
        fs::rename(&temp_path, &target).map_err(|error| {
            format!(
                "重命名失败：{} -> {} ({error})",
                temp_path.display(),
                target.display()
            )
        })?;

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
        let destination = root.join(file_name);

        if request.dry_run {
            report.info("预览：将复制补充文件到根目录。", Some(&source));
        } else if destination.exists() {
            report.info("补充文件已在根目录，未重复复制。", Some(&destination));
            continue;
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

fn copy_extra_file_names(request: &ProcessRequest) -> HashSet<String> {
    if !request.copy_extras {
        return HashSet::new();
    }

    request
        .copy_files
        .iter()
        .map(PathBuf::from)
        .filter_map(|path| {
            path.file_name()
                .map(|name| normalize_name(&name.to_string_lossy()))
        })
        .collect()
}

fn is_selected_copy_extra(path: &Path, copy_file_names: &HashSet<String>) -> bool {
    path.file_name()
        .map(|name| copy_file_names.contains(&normalize_name(&name.to_string_lossy())))
        .unwrap_or(false)
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
