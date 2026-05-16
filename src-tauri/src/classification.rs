use std::path::Path;

use crate::models::{Category, FolderNames};

pub(crate) fn category_for_path(path: &Path, include_text: bool) -> Option<Category> {
    let ext = path.extension()?.to_string_lossy().to_lowercase();
    match ext.as_str() {
        "gif" => Some(Category::Gifs),
        "jpg" | "jpeg" | "png" | "webp" | "bmp" | "tif" | "tiff" | "avif" | "heic" | "heif" => {
            Some(Category::Images)
        }
        "mp4" | "mov" | "mkv" | "avi" | "wmv" | "m4v" | "webm" | "flv" | "ts" | "m2ts" => {
            Some(Category::Videos)
        }
        "txt" => Some(Category::Images),
        "md" | "nfo" if include_text => Some(Category::Texts),
        _ => None,
    }
}

pub(crate) fn is_copyable_extra(path: &Path) -> bool {
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

pub(crate) fn is_txt_file(path: &Path) -> bool {
    matches!(
        path.extension()
            .map(|ext| ext.to_string_lossy().to_lowercase())
            .as_deref(),
        Some("txt")
    )
}

pub(crate) fn category_folder_name<'a>(
    category: Category,
    folder_names: &'a FolderNames,
) -> &'a str {
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

#[cfg(test)]
mod tests {
    use std::path::Path;

    use super::*;

    #[test]
    fn txt_is_supported_as_root_extra() {
        assert!(is_copyable_extra(Path::new("notes.txt")));
    }

    #[test]
    fn txt_always_joins_image_package() {
        assert_eq!(
            category_for_path(Path::new("notes.txt"), false),
            Some(Category::Images)
        );
        assert_eq!(
            category_for_path(Path::new("notes.txt"), true),
            Some(Category::Images)
        );
    }

    #[test]
    fn md_and_nfo_still_use_text_category_when_enabled() {
        assert_eq!(
            category_for_path(Path::new("readme.nfo"), true),
            Some(Category::Texts)
        );
        assert_eq!(
            category_for_path(Path::new("readme.md"), true),
            Some(Category::Texts)
        );
    }
}
