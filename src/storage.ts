import { settingsStorageKey } from "./config";
import type { PersistedSettings } from "./types";

export function readPersistedSettings(): Partial<PersistedSettings> {
  try {
    const raw = localStorage.getItem(settingsStorageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<PersistedSettings>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function writePersistedSettings(settings: PersistedSettings) {
  try {
    localStorage.setItem(settingsStorageKey, JSON.stringify(settings));
  } catch {
    // Settings persistence is best-effort; file operations must keep working.
  }
}
