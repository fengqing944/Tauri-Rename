import type { DirectoryMapping, FolderPreset } from "./types";

export const folderPresets: FolderPreset[] = [
  {
    id: "cn-standard",
    name: "中文归档",
    folders: { images: "图包", videos: "视频", gifs: "GIF", texts: "文本" },
  },
  {
    id: "creator-pack",
    name: "作品包",
    folders: { images: "图片", videos: "视频", gifs: "动图", texts: "文档" },
  },
  {
    id: "en-clean",
    name: "English",
    folders: { images: "Images", videos: "Videos", gifs: "GIF", texts: "Text" },
  },
];

export const defaultMappings: DirectoryMapping[] = [
  { from: "Pic", to: "图包" },
  { from: "Pics", to: "图包" },
  { from: "Picture", to: "图包" },
  { from: "Pictures", to: "图包" },
  { from: "Image", to: "图包" },
  { from: "Images", to: "图包" },
  { from: "Video", to: "视频" },
  { from: "Videos", to: "视频" },
  { from: "Movie", to: "视频" },
  { from: "Movies", to: "视频" },
  { from: "Gif", to: "GIF" },
  { from: "GIFs", to: "GIF" },
  { from: "Text", to: "文本" },
  { from: "TXT", to: "文本" },
];

export const copyableExtensions = [
  "jpg",
  "jpeg",
  "png",
  "webp",
  "bmp",
  "tif",
  "tiff",
  "avif",
  "heic",
  "heif",
  "gif",
  "txt",
];

export const settingsStorageKey = "rename-studio-settings-v1";
export const defaultFolderNames = folderPresets[0].folders;
export const defaultSpecialDirs = ["Bonus", "Extras", "特典"];
export const defaultRenamePattern = "{folder}_{category}_{index}";
