use std::path::{Path, PathBuf};

pub(crate) fn build_file_name(
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

pub(crate) fn unique_path(path: &Path) -> PathBuf {
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
