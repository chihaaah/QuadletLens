export type Language = "en" | "ja";
export type Theme = "light" | "dark";
const legacyPreferenceKeys: Readonly<Record<string, string>> = {
  "quadletlens.theme": "compose2quadlet.theme",
  "quadletlens.language": "compose2quadlet.language",
};

type StorageReader = Pick<Storage, "getItem">;
type StorageWriter = Pick<Storage, "setItem">;

export function readPreference<T extends string>(
  storage: StorageReader,
  key: string,
  allowed: readonly T[],
): T | undefined {
  try {
    const value = storage.getItem(key);
    const current = allowed.find((item) => item === value);
    if (current !== undefined) return current;
    // Read legacy preferences on this origin only; all writes use new keys.
    const legacyKey = legacyPreferenceKeys[key];
    return legacyKey
      ? allowed.find((item) => item === storage.getItem(legacyKey))
      : undefined;
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
  language: "quadletlens.language",
  theme: "quadletlens.theme",
} as const;

// Accessing localStorage itself can throw in restricted browser contexts.
export function storage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
