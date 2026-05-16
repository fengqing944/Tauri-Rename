export type Mode = "single" | "batch";
export type ProcessingMode = "organize" | "renameOnly";
export type RuleTab = "rules" | "mapping" | "special" | "log";

export type FolderNames = {
  images: string;
  videos: string;
  gifs: string;
  texts: string;
};

export type DirectoryMapping = {
  from: string;
  to: string;
};

export type LogEntry = {
  level: "info" | "success" | "warn" | string;
  message: string;
  path?: string | null;
};

export type ProcessReport = {
  rootsProcessed: number;
  foldersCreated: number;
  foldersRenamed: number;
  filesMoved: number;
  filesRenamed: number;
  filesCopied: number;
  skipped: number;
  logPath?: string | null;
  entries: LogEntry[];
};

export type FolderPreset = {
  id: string;
  name: string;
  folders: FolderNames;
};

export type PersistedSettings = {
  version: 1;
  mode?: Mode;
  processingMode?: ProcessingMode;
  presetId?: string;
  folderNames?: FolderNames;
  mappings?: DirectoryMapping[];
  specialDirs?: string[];
  copyFiles?: string[];
  copyExtras?: boolean;
  includeText?: boolean;
  dryRun?: boolean;
  reverseRenameOrder?: boolean;
  closeToTray?: boolean;
  renamePattern?: string;
  startIndex?: number;
  padding?: number;
};
