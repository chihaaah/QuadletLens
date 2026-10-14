export type Language = "en" | "ja";
export type Theme = "light" | "dark";
type StorageReader = Pick<Storage, "getItem">;
type StorageWriter = Pick<Storage, "setItem">;

export function readPreference<T extends string>(
  storage: StorageReader,
  key: string,
  allowed: readonly T[],
): T | undefined {
  try {
    const value = storage.getItem(key);
    return allowed.find((item) => item === value);
  } catch {
    return undefined;
  }
}

export function savePreference(
  storage: StorageWriter,
  key: string,
  value: string,
): void {
  try {
    storage.setItem(key, value);
  } catch {
    /* Preferences remain usable in memory when storage is blocked. */
  }
}

export function browserLanguage(language: string): Language {
  return /^ja(?:-|$)/i.test(language) ? "ja" : "en";
}

export const preferenceKeys = {
  language: "compose2quadlet.language",
  theme: "compose2quadlet.theme",
} as const;

// Accessing localStorage itself can throw in restricted browser contexts.
export function storage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
