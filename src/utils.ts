import { defaultMappings } from "./config";
import type { DirectoryMapping, FolderNames, Mode, ProcessingMode } from "./types";

export function normalizeSelection(selection: string | string[] | null): string[] {
  if (!selection) return [];
  return Array.isArray(selection) ? selection : [selection];
}

export function shortName(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : path;
}

export function normalizeKey(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function compareText(left: string, right: string): number {
  return left.localeCompare(right, "zh-Hans-CN", {
    numeric: true,
    sensitivity: "base",
  });
}

export function sortMappings(items: DirectoryMapping[]): DirectoryMapping[] {
  return [...items].sort((left, right) => {
    const fromCompare = compareText(left.from, right.from);
    return fromCompare === 0 ? compareText(left.to, right.to) : fromCompare;
  });
}

export function uniqueMerge(current: string[], incoming: string[], mode: Mode): string[] {
  const merged = [...current];

  for (const path of incoming) {
    if (!merged.includes(path)) {
      merged.push(path);
    }
  }

  return mode === "single" ? merged.slice(-1) : merged;
}

export function splitNames(value: string): string[] {
  return value
    .split(/[\n,，]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function findDuplicateMappingKeys(mappings: DirectoryMapping[]): Set<string> {
  const counts = new Map<string, number>();

  for (const mapping of mappings) {
    const key = normalizeKey(mapping.from);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key));
}

export function isMode(value: unknown): value is Mode {
  return value === "single" || value === "batch";
}

export function isProcessingMode(value: unknown): value is ProcessingMode {
  return value === "organize" || value === "renameOnly";
}

export function isFolderNames(value: unknown): value is FolderNames {
  if (!value || typeof value !== "object") return false;
  const folderNames = value as Record<string, unknown>;
  return ["images", "videos", "gifs", "texts"].every(
    (key) => typeof folderNames[key] === "string",
  );
}

export function cleanStringArray(value: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(value)) return fallback;
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

export function cleanMappings(value: unknown): DirectoryMapping[] {
  if (!Array.isArray(value)) return sortMappings(defaultMappings);

  const seen = new Set<string>();
  const mappings = value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Record<string, unknown>;
    if (typeof candidate.from !== "string" || typeof candidate.to !== "string") return [];

    const from = candidate.from.trim();
    const to = candidate.to.trim();
    const key = normalizeKey(from);
    if (!from || !to || seen.has(key)) return [];

    seen.add(key);
    return [{ from, to: key === "txt" && normalizeKey(to) === "文本" ? "图包" : to }];
  });

  return mappings.length ? sortMappings(mappings) : sortMappings(defaultMappings);
}
