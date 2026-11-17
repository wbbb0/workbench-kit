import {
  computed,
  getCurrentInstance,
  inject,
  provide,
  reactive,
  ref,
  shallowRef,
  watch,
  type ComputedRef,
  type InjectionKey,
  type Ref,
  type ShallowRef,
} from "vue";
import type {
  WorkbenchAreaId,
  WorkbenchDesktopAreaId,
  WorkbenchView,
} from "../types.js";

import {
  createWorkbenchPageNavigator,
  type WorkbenchPageNavigation,
  type WorkbenchPageNavigator,
} from "./pageNavigation";

export type MobileAreaStackEntry = {
  areaId: WorkbenchAreaId;
  viewId: string;
  detailKey?: string;
};

export type DesktopAreaId = WorkbenchDesktopAreaId;
export type DesktopAreaStyle = {
  width?: string;
  height?: string;
};
export type DesktopAreaSizeRange = {
  min: number;
  max: number;
};

export type WorkbenchRuntime = {
  view: ComputedRef<WorkbenchView>;
  pages: WorkbenchPageNavigator;
  mainRegionRef: Ref<HTMLElement | null>;
  keyboardAvoidanceBoundary: ComputedRef<HTMLElement | null>;
  getDesktopAreaSizePx: (areaId: DesktopAreaId) => number;
  getDesktopAreaSizeRange?: (areaId: DesktopAreaId) => DesktopAreaSizeRange;
  getDesktopAreaStyle: (areaId: DesktopAreaId) => DesktopAreaStyle;
  clampDesktopAreaSize: (areaId: DesktopAreaId, sizePx: number) => number;
  setDesktopAreaSize: (areaId: DesktopAreaId, sizePx: number) => void;
  resetDesktopAreaSize: (areaId: DesktopAreaId) => void;
  mobileRootAreaId: ComputedRef<WorkbenchAreaId>;
  mobileAreaStack: Ref<MobileAreaStackEntry[]>;
  mobileTopArea: ComputedRef<MobileAreaStackEntry>;
  activeMobileAreaId: ComputedRef<WorkbenchAreaId>;
  canPopMobileArea: ComputedRef<boolean>;
  resetMobileAreaStack: () => void;
  showArea: (areaId: WorkbenchAreaId, detailKey?: string) => void;
  showRootArea: () => void;
  popMobileArea: () => boolean;
};

const workbenchRuntimeKey: InjectionKey<WorkbenchRuntime> =
  Symbol("workbench-runtime");
const activeWorkbenchRuntime = shallowRef<WorkbenchRuntime | null>(null);
const desktopAreaStoragePrefix = "workbench.area.desktop";
const desktopAreaIds = [
  "primarySidebar",
  "secondarySidebar",
  "bottomPanel",
] as const satisfies readonly DesktopAreaId[];
const defaultDesktopAreaSize: Record<
  DesktopAreaId,
  { defaultSizePx: number; minSizePx: number; maxSizePx: number }
> = {
  primarySidebar: {
    defaultSizePx: 260,
    minSizePx: 180,
    maxSizePx: 520,
  },
  secondarySidebar: {
    defaultSizePx: 300,
    minSizePx: 200,
    maxSizePx: 640,
  },
  bottomPanel: {
    defaultSizePx: 240,
    minSizePx: 120,
    maxSizePx: 520,
  },
};

export function getWorkbenchDesktopAreaSizeRange(
  runtime: WorkbenchRuntime,
  areaId: DesktopAreaId,
): DesktopAreaSizeRange {
  return (
    runtime.getDesktopAreaSizeRange?.(areaId) ?? {
      min: runtime.clampDesktopAreaSize(areaId, Number.MIN_SAFE_INTEGER),
      max: runtime.clampDesktopAreaSize(areaId, Number.MAX_SAFE_INTEGER),
    }
  );
}

function resolveDesktopAreaStorageKey(areaId: DesktopAreaId) {
  return `${desktopAreaStoragePrefix}.${areaId}.size`;
}

function readStoredDesktopAreaSize(areaId: DesktopAreaId): number | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const value = window.localStorage.getItem(
      resolveDesktopAreaStorageKey(areaId),
    );
    if (!value) {
      return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeStoredDesktopAreaSize(areaId: DesktopAreaId, sizePx: number) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(
      resolveDesktopAreaStorageKey(areaId),
      String(sizePx),
    );
  } catch {
    // Layout resizing remains usable when storage is unavailable.
  }
}

export function createWorkbenchRuntime(
  view: ComputedRef<WorkbenchView>,
  pageNavigation = computed<WorkbenchPageNavigation | undefined>(
    () => undefined,
  ),
): WorkbenchRuntime {
  const pages = createWorkbenchPageNavigator(view, pageNavigation);
  const mainRegionRef = ref<HTMLElement | null>(null);
  const mobileAreaStack = ref<MobileAreaStackEntry[]>([]);
  const desktopAreaSizesPx = reactive<Record<DesktopAreaId, number>>({
    primarySidebar: resolveInitialDesktopAreaSize("primarySidebar"),
    secondarySidebar: resolveInitialDesktopAreaSize("secondarySidebar"),
    bottomPanel: resolveInitialDesktopAreaSize("bottomPanel"),
  });
  const mobileRootAreaId = computed(
    () => pages.path.value[0]?.areaId ?? resolveMobileRootAreaId(),
  );
  const mobileTopArea = computed(() =>
    pages.controlled.value
      ? createMobileAreaEntry(
          pages.current.value?.areaId ?? mobileRootAreaId.value,
          pages.current.value?.key,
        )
      : (mobileAreaStack.value[mobileAreaStack.value.length - 1] ??
        createMobileAreaEntry(mobileRootAreaId.value)),
  );
  const activeMobileAreaId = computed(() => mobileTopArea.value.areaId);
  const canPopMobileArea = computed(() =>
    pages.controlled.value
      ? pages.canGoBack.value
      : mobileAreaStack.value.length > 1,
  );
  const keyboardAvoidanceBoundary = computed(() => mainRegionRef.value);

  function resolveMobileRootAreaId(): WorkbenchAreaId {
    const configuredAreaId = view.value.layout.mobile.rootArea;
    if (configuredAreaId === "mainArea" || view.value.areas[configuredAreaId]) {
      return configuredAreaId;
    }
    return "mainArea";
  }

  function createMobileAreaEntry(
    areaId: WorkbenchAreaId,
    detailKey?: string,
  ): MobileAreaStackEntry {
    return {
      areaId,
      viewId: view.value.id,
      ...(detailKey === undefined ? {} : { detailKey }),
    };
  }

  function resolveTargetMobileAreaId(areaId: WorkbenchAreaId): WorkbenchAreaId {
    if (areaId === "mainArea" || view.value.areas[areaId]) {
      return areaId;
    }
    return mobileRootAreaId.value;
  }

  function resolveDesktopAreaDefaultSize(areaId: DesktopAreaId) {
    return (
      view.value.layout.desktop[areaId]?.defaultSizePx ??
      defaultDesktopAreaSize[areaId].defaultSizePx
    );
  }

  function resolveInitialDesktopAreaSize(areaId: DesktopAreaId) {
    return clampDesktopAreaSize(
      areaId,
      readStoredDesktopAreaSize(areaId) ??
        resolveDesktopAreaDefaultSize(areaId),
    );
  }

  function resolveDesktopAreaMinSize(areaId: DesktopAreaId) {
    return (
      view.value.layout.desktop[areaId]?.minSizePx ??
      defaultDesktopAreaSize[areaId].minSizePx
    );
  }

  function resolveDesktopAreaMaxSize(areaId: DesktopAreaId) {
    return Math.max(
      resolveDesktopAreaMinSize(areaId),
      view.value.layout.desktop[areaId]?.maxSizePx ??
        defaultDesktopAreaSize[areaId].maxSizePx,
    );
  }

  function clampDesktopAreaSize(areaId: DesktopAreaId, sizePx: number) {
    return Math.min(
      resolveDesktopAreaMaxSize(areaId),
      Math.max(resolveDesktopAreaMinSize(areaId), Math.round(sizePx)),
    );
  }

  function getDesktopAreaSizePx(areaId: DesktopAreaId) {
    return desktopAreaSizesPx[areaId];
  }

  function getDesktopAreaSizeRange(
    areaId: DesktopAreaId,
  ): DesktopAreaSizeRange {
    return {
      min: resolveDesktopAreaMinSize(areaId),
      max: resolveDesktopAreaMaxSize(areaId),
    };
  }

  function getDesktopAreaStyle(areaId: DesktopAreaId) {
    const size = `${getDesktopAreaSizePx(areaId)}px`;
    return areaId === "bottomPanel" ? { height: size } : { width: size };
  }

  function setDesktopAreaSize(areaId: DesktopAreaId, sizePx: number) {
    const nextSize = clampDesktopAreaSize(areaId, sizePx);
    desktopAreaSizesPx[areaId] = nextSize;
    writeStoredDesktopAreaSize(areaId, nextSize);
  }

  function resetDesktopAreaSize(areaId: DesktopAreaId) {
    setDesktopAreaSize(areaId, resolveDesktopAreaDefaultSize(areaId));
  }

  function allowAreaNavigation() {
    if (!pages.controlled.value) return true;
    console.warn("受控页面导航请使用 openPage/backPage，不能同时修改区域栈。");
    return false;
  }

  function resetMobileAreaStack() {
    if (pages.controlled.value) return;
    mobileAreaStack.value = [createMobileAreaEntry(mobileRootAreaId.value)];
  }

  function showRootArea() {
    if (!allowAreaNavigation()) return;
    resetMobileAreaStack();
  }

  function showArea(areaId: WorkbenchAreaId, detailKey?: string) {
    if (!allowAreaNavigation()) return;
    const targetAreaId = resolveTargetMobileAreaId(areaId);
    if (targetAreaId === mobileRootAreaId.value) {
      mobileAreaStack.value = [createMobileAreaEntry(targetAreaId, detailKey)];
      return;
    }
    if (targetAreaId === "mainArea") {
      mobileAreaStack.value = [
        createMobileAreaEntry(mobileRootAreaId.value),
        createMobileAreaEntry(targetAreaId, detailKey),
      ];
      return;
    }
    if (mobileTopArea.value.areaId === "mainArea") {
      mobileAreaStack.value = [
        createMobileAreaEntry(mobileRootAreaId.value),
        createMobileAreaEntry("mainArea"),
        createMobileAreaEntry(targetAreaId, detailKey),
      ];
      return;
    }
    mobileAreaStack.value = [
      createMobileAreaEntry(mobileRootAreaId.value),
      createMobileAreaEntry(targetAreaId, detailKey),
    ];
  }

  function popMobileArea() {
    if (!allowAreaNavigation()) return false;
    if (!canPopMobileArea.value) {
      return false;
    }
    mobileAreaStack.value = mobileAreaStack.value.slice(0, -1);
    return true;
  }

  watch(
    () => view.value.id,
    () => {
      for (const areaId of desktopAreaIds) {
        desktopAreaSizesPx[areaId] = resolveInitialDesktopAreaSize(areaId);
      }
    },
  );

  resetMobileAreaStack();

  return {
    view,
    pages,
    mainRegionRef,
    keyboardAvoidanceBoundary,
    getDesktopAreaSizePx,
    getDesktopAreaSizeRange,
    getDesktopAreaStyle,
    clampDesktopAreaSize,
    setDesktopAreaSize,
    resetDesktopAreaSize,
    mobileRootAreaId,
    mobileAreaStack,
    mobileTopArea,
    activeMobileAreaId,
    canPopMobileArea,
    resetMobileAreaStack,
    showArea,
    showRootArea,
    popMobileArea,
  };
}

export function provideWorkbenchRuntime(runtime: WorkbenchRuntime): void {
  provide(workbenchRuntimeKey, runtime);
}

export function useWorkbenchRuntimeContext(): WorkbenchRuntime | null {
  return getCurrentInstance() ? inject(workbenchRuntimeKey, null) : null;
}

export function activateWorkbenchRuntime(
  runtime: WorkbenchRuntime,
): () => void {
  const previousRuntime = activeWorkbenchRuntime.value;
  activeWorkbenchRuntime.value = runtime;
  return () => {
    if (activeWorkbenchRuntime.value === runtime) {
      activeWorkbenchRuntime.value = previousRuntime;
    }
  };
}

export function useActiveWorkbenchRuntime(): ShallowRef<WorkbenchRuntime | null> {
  return activeWorkbenchRuntime;
}

export function useWorkbenchNavigation() {
  const bound = useWorkbenchRuntimeContext();
  const owner = bound?.view.value.id;
  const resolve = () =>
    bound
      ? bound.view.value.id === owner
        ? bound
        : null
      : activeWorkbenchRuntime.value;
  return {
    currentPage: computed(() => resolve()?.pages.current.value),
    canGoBack: computed(() => resolve()?.pages.canGoBack.value ?? false),
    openPage(
      target: import("./pageNavigation").WorkbenchPageLocation,
      options = { replace: false },
    ) {
      return resolve()?.pages.open(target, options) ?? Promise.resolve(false);
    },
    backPage() {
      return resolve()?.pages.back() ?? Promise.resolve(false);
    },
    showArea(areaId: WorkbenchAreaId, detailKey?: string) {
      resolve()?.showArea(areaId, detailKey);
    },
    showRootArea() {
      resolve()?.showRootArea();
    },
    popArea() {
      return resolve()?.popMobileArea() ?? false;
    },
  };
}
