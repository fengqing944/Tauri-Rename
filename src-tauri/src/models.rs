use std::path::PathBuf;

use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProcessRequest {
    pub(crate) roots: Vec<String>,
    pub(crate) folder_names: FolderNames,
    pub(crate) mappings: Vec<DirectoryMapping>,
    pub(crate) special_dirs: Vec<String>,
    pub(crate) copy_files: Vec<String>,
    pub(crate) copy_extras: bool,
    pub(crate) rename_pattern: String,
    pub(crate) start_index: u32,
    pub(crate) padding: usize,
    pub(crate) dry_run: bool,
    pub(crate) include_text: bool,
    pub(crate) reverse_rename_order: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct FolderNames {
    pub(crate) images: String,
    pub(crate) videos: String,
    pub(crate) gifs: String,
    pub(crate) texts: String,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DirectoryMapping {
    pub(crate) from: String,
    pub(crate) to: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub(crate) enum Category {
    Images,
    Videos,
    Gifs,
    Texts,
}

#[derive(Debug)]
pub(crate) struct RenameOperation {
    pub(crate) source: PathBuf,
    pub(crate) target: PathBuf,
}
