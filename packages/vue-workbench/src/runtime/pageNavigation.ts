import { computed, readonly, ref, watch, type ComputedRef } from "vue";
import type { WorkbenchAreaId, WorkbenchView } from "../types";

export interface WorkbenchPageLocation {
  key: string;
  title: string;
  areaId: WorkbenchAreaId;
  /** 宿主可保留详情渲染参数以启用移动区域转场。kit 原样保留，页面切换期间参数应稳定。 */
  presentation?: unknown;
}
export interface WorkbenchPageNavigation {
  viewId: string;
  path: readonly WorkbenchPageLocation[];
  navigate(
    target: WorkbenchPageLocation,
    options: { replace: boolean },
  ): Promise<boolean> | boolean;
}

/** 只派生页面层级，不复制路由状态，不操作浏览器历史。 */
export function createWorkbenchPageNavigator(
  view: ComputedRef<WorkbenchView>,
  source: ComputedRef<WorkbenchPageNavigation | undefined>,
) {
  const controlled = computed(() => source.value !== undefined);
  const binding = computed(() =>
    source.value?.viewId === view.value.id ? source.value : undefined,
  );
  const path = computed(() => binding.value?.path ?? []);
  const current = computed(() => path.value.at(-1));
  const parent = computed(() => path.value.at(-2));
  const pending = ref(false);
  const error = ref("");
  let generation = 0;
  watch(
    () => view.value.id,
    () => {
      generation++;
      pending.value = false;
      error.value = "";
    },
    { flush: "sync" },
  );
  async function open(
    target: WorkbenchPageLocation,
    options = { replace: false },
  ): Promise<boolean> {
    const navigation = binding.value;
    if (!navigation || pending.value || !view.value.areas[target.areaId])
      return false;
    const turn = ++generation;
    pending.value = true;
    error.value = "";
    try {
      const accepted = await navigation.navigate(target, options);
      return turn === generation && accepted;
    } catch (cause) {
      if (turn === generation)
        error.value = cause instanceof Error ? cause.message : String(cause);
      return false;
    } finally {
      if (turn === generation) pending.value = false;
    }
  }
  return {
    controlled,
    path,
    current,
    parent,
    canGoBack: computed(() => !!parent.value),
    pending: readonly(pending),
    error: readonly(error),
    open,
    back: () =>
      parent.value
        ? open(parent.value, { replace: true })
        : Promise.resolve(false),
  };
}
export type WorkbenchPageNavigator = ReturnType<
  typeof createWorkbenchPageNavigator
>;
