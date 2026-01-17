import { useState, useCallback, useEffect } from "react";

const PREFERENCES_KEY = "user-preferences";

export interface UserPreferences {
  // View modes
  partyHallViewMode: "list" | "calendar";
  whatsappTemplatesViewMode: "grid" | "list";
  
  // Pagination
  defaultItemsPerPage: number;
  
  // Porteiro preferences
  porteiroLastBlock: string | null;
  porteiroLastApartment: string | null;
}

const defaultPreferences: UserPreferences = {
  partyHallViewMode: "list",
  whatsappTemplatesViewMode: "grid",
  defaultItemsPerPage: 10,
  porteiroLastBlock: null,
  porteiroLastApartment: null,
};

function loadPreferences(): UserPreferences {
  if (typeof window === "undefined") return defaultPreferences;
  try {
    const stored = localStorage.getItem(PREFERENCES_KEY);
    if (stored) {
      return { ...defaultPreferences, ...JSON.parse(stored) };
    }
  } catch {
    // localStorage not available or invalid JSON
  }
  return defaultPreferences;
}

function savePreferences(preferences: UserPreferences): void {
  try {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    // localStorage not available
  }
}

export function useUserPreferences() {
  const [preferences, setPreferencesState] = useState<UserPreferences>(loadPreferences);

  // Sync with localStorage when preferences change
  useEffect(() => {
    savePreferences(preferences);
  }, [preferences]);

  const setPreference = useCallback(<K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => {
    setPreferencesState((prev) => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  const setPreferences = useCallback((updates: Partial<UserPreferences>) => {
    setPreferencesState((prev) => ({
      ...prev,
      ...updates,
    }));
  }, []);

  const resetPreferences = useCallback(() => {
    setPreferencesState(defaultPreferences);
    try {
      localStorage.removeItem(PREFERENCES_KEY);
    } catch {
      // localStorage not available
    }
  }, []);

  return {
    preferences,
    setPreference,
    setPreferences,
    resetPreferences,
  };
}

// Individual hooks for specific preferences (for convenience)
export function useViewModePreference<T extends string>(
  key: "partyHallViewMode" | "whatsappTemplatesViewMode",
  defaultValue: T
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return defaultValue;
    try {
      const stored = localStorage.getItem(PREFERENCES_KEY);
      if (stored) {
        const prefs = JSON.parse(stored);
        return prefs[key] || defaultValue;
      }
    } catch {
      // localStorage not available
    }
    return defaultValue;
  });

  const setViewMode = useCallback((newValue: T) => {
    setValue(newValue);
    try {
      const stored = localStorage.getItem(PREFERENCES_KEY);
      const prefs = stored ? JSON.parse(stored) : {};
      prefs[key] = newValue;
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(prefs));
    } catch {
      // localStorage not available
    }
  }, [key]);

  return [value, setViewMode];
}

export function useItemsPerPagePreference(
  storageKey: string,
  defaultValue: number = 10
): [number, (value: number) => void] {
  const [value, setValue] = useState<number>(() => {
    if (typeof window === "undefined") return defaultValue;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        return parseInt(stored, 10) || defaultValue;
      }
    } catch {
      // localStorage not available
    }
    return defaultValue;
  });

  const setItemsPerPage = useCallback((newValue: number) => {
    setValue(newValue);
    try {
      localStorage.setItem(storageKey, String(newValue));
    } catch {
      // localStorage not available
    }
  }, [storageKey]);

  return [value, setItemsPerPage];
}
