import { readonly, ref, type Ref } from "vue";

export type WorkbenchThemeMode = "system" | "light" | "dark";
export type WorkbenchResolvedTheme = "light" | "dark";

export type WorkbenchThemeOptions = {
  mode?: WorkbenchThemeMode;
  palette?: string;
  storageKey?: string;
  paletteStorageKey?: string;
};

export type WorkbenchThemeController = {
  mode: Readonly<Ref<WorkbenchThemeMode>>;
  resolvedTheme: Readonly<Ref<WorkbenchResolvedTheme>>;
  palette: Readonly<Ref<string | undefined>>;
  setMode: (next: WorkbenchThemeMode) => void;
  setPalette: (next: string | undefined) => void;
  toggle: () => void;
  stop: () => void;
};

function readStoredValue(key: string | undefined): string | null {
  if (!key || typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStoredValue(key: string | undefined, value: string | null) {
  if (!key || typeof window === "undefined") {
    return;
  }
  try {
    if (value === null) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // 忽略隐私模式或存储受限错误，保持内存状态可用。
  }
}

function normalizeThemeMode(value: string | null | undefined): WorkbenchThemeMode | undefined {
  if (value === "system" || value === "light" || value === "dark") {
    return value;
  }
  return undefined;
}

function normalizePalette(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

let activeController: WorkbenchThemeController | null = null;

/** 初始化全局亮暗模式与主题色板控制器；重复调用会清理前一个监听实例。 */
export function initWorkbenchTheme(
  options: WorkbenchThemeOptions = {},
): WorkbenchThemeController {
  activeController?.stop();

  const storedMode = normalizeThemeMode(readStoredValue(options.storageKey));
  const storedPalette = normalizePalette(readStoredValue(options.paletteStorageKey));
  const mode = ref<WorkbenchThemeMode>(storedMode ?? options.mode ?? "system");
  const palette = ref<string | undefined>(
    storedPalette ?? normalizePalette(options.palette),
  );

  const preference =
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-color-scheme: dark)")
      : null;

  const computeResolved = (): WorkbenchResolvedTheme => {
    if (mode.value === "light" || mode.value === "dark") {
      return mode.value;
    }
    return preference?.matches ? "dark" : "light";
  };

  const resolvedTheme = ref<WorkbenchResolvedTheme>(computeResolved());

  function syncDocument() {
    const resolved = computeResolved();
    resolvedTheme.value = resolved;
    if (typeof document === "undefined") {
      return;
    }
    const root = document.documentElement;
    root.dataset.theme = resolved;
    root.style.colorScheme = resolved;
    if (palette.value) {
      root.dataset.palette = palette.value;
    } else {
      delete root.dataset.palette;
    }
  }

  const onMediaChange = () => {
    if (mode.value === "system") {
      syncDocument();
    }
  };

  let stopped = false;
  syncDocument();
  if (preference && typeof preference.addEventListener === "function") {
    preference.addEventListener("change", onMediaChange);
  }

  function setMode(next: WorkbenchThemeMode) {
    mode.value = next;
    writeStoredValue(options.storageKey, next);
    syncDocument();
  }

  function setPalette(next: string | undefined) {
    const normalized = normalizePalette(next);
    palette.value = normalized;
    writeStoredValue(options.paletteStorageKey, normalized ?? null);
    syncDocument();
  }

  function toggle() {
    setMode(resolvedTheme.value === "dark" ? "light" : "dark");
  }

  function stop() {
    if (stopped) {
      return;
    }
    stopped = true;
    if (preference && typeof preference.removeEventListener === "function") {
      preference.removeEventListener("change", onMediaChange);
    }
    if (activeController === controller) {
      activeController = null;
    }
  }

  const controller: WorkbenchThemeController = {
    mode: readonly(mode),
    resolvedTheme: readonly(resolvedTheme),
    palette: readonly(palette),
    setMode,
    setPalette,
    toggle,
    stop,
  };

  if (typeof document !== "undefined") {
    activeController = controller;
  }
  return controller;
}

/** 读取当前激活的主题控制器；若尚未初始化或处于 SSR，则按 `system` 模式返回临时/全局控制器。 */
export function useWorkbenchTheme(): WorkbenchThemeController {
  if (typeof document === "undefined") {
    return initWorkbenchTheme();
  }
  return activeController ?? initWorkbenchTheme();
}
