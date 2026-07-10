import { onMounted, onUnmounted, readonly, ref, watch, type Ref } from "vue";

/** 响应式 viewport 判定器。业务可在应用启动时注册自己的实现。 */
export type WorkbenchViewportDetector = {
  isMobile: () => boolean;
  subscribe: (listener: () => void) => () => void;
};

const mobileMediaQuery = "(max-width: 767px)";

const defaultWorkbenchViewportDetector: WorkbenchViewportDetector = {
  isMobile() {
    return typeof window !== "undefined"
      && typeof window.matchMedia === "function"
      && window.matchMedia(mobileMediaQuery).matches;
  },
  subscribe(listener) {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return () => {};
    }
    const mediaQuery = window.matchMedia(mobileMediaQuery);
    mediaQuery.addEventListener("change", listener);
    return () => mediaQuery.removeEventListener("change", listener);
  }
};

const activeWorkbenchViewportDetector = ref<WorkbenchViewportDetector>(defaultWorkbenchViewportDetector);

/**
 * 替换全局 viewport 判定器。省略参数可恢复内置 media-query 实现。
 * 应在挂载任何 WorkbenchRoot 前调用。
 */
export function configureWorkbenchViewportDetector(detector?: WorkbenchViewportDetector): void {
  activeWorkbenchViewportDetector.value = detector ?? defaultWorkbenchViewportDetector;
}

/** 当前组件树使用的响应式 viewport 状态。 */
export function useWorkbenchViewport(): { isMobile: Readonly<Ref<boolean>> } {
  const isMobile = ref(false);
  let unsubscribe = () => {};
  let stopWatching = () => {};

  onMounted(() => {
    stopWatching = watch(activeWorkbenchViewportDetector, (detector) => {
      unsubscribe();
      const sync = () => {
        isMobile.value = detector.isMobile();
      };
      sync();
      unsubscribe = detector.subscribe(sync);
    }, { immediate: true });
  });

  onUnmounted(() => {
    unsubscribe();
    stopWatching();
  });

  return { isMobile: readonly(isMobile) };
}
