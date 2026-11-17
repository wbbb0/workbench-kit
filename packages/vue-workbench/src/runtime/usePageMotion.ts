import { nextTick, onBeforeUnmount, watch, type ComputedRef } from "vue";

export interface PageMotionLocation {
  viewId: string;
  keys: readonly string[];
}
export function pageMotionDirection(
  from: PageMotionLocation,
  to: PageMotionLocation,
) {
  if (from.viewId !== to.viewId || from.keys.at(-1) === to.keys.at(-1))
    return undefined;
  const prefix = (a: readonly string[], b: readonly string[]) =>
    a.length < b.length && a.every((key, i) => b[i] === key);
  if (prefix(from.keys, to.keys)) return "forward" as const;
  if (prefix(to.keys, from.keys)) return "back" as const;
  return undefined;
}

/** 只对已完成导航的显示区域做方向动画，不重建页面、延迟路由或保存第二份历史。 */
export function usePageMotion(
  location: ComputedRef<PageMotionLocation>,
  surface: () => HTMLElement | null,
) {
  let animation: Animation | undefined;
  let generation = 0;
  const stop = () => {
    generation++;
    animation?.cancel();
    animation = undefined;
  };
  watch(location, async (to, from) => {
    if (to.viewId === from.viewId && to.keys.at(-1) === from.keys.at(-1))
      return;
    stop();
    const direction = pageMotionDirection(from, to);
    if (
      !direction ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const turn = generation;
    await nextTick();
    const element = surface();
    if (turn !== generation || !element?.animate) return;
    animation = element.animate(
      [
        {
          transform: `translateX(${direction === "forward" ? "100%" : "-100%"})`,
        },
        { transform: "translateX(0)" },
      ],
      { duration: 220, easing: "ease", id: `workbench-page-${direction}` },
    );
  });
  onBeforeUnmount(stop);
}
