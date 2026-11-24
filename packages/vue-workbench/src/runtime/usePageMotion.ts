import {
  nextTick,
  onBeforeUnmount,
  onMounted,
  shallowRef,
  watch,
  type ComputedRef,
} from "vue";

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

/** 同一份双页过渡用于区域与分栏。页面描述仅在离场期间保留。 */
export function usePageSurfaceMotion<P extends { key: string }>(
  source: ComputedRef<{
    pages: readonly P[];
    layoutKey: string;
    enabled: boolean;
  }>,
  surfaces: () => readonly [HTMLElement | null, HTMLElement | null],
  canAnimate?: (from: P, to: P) => boolean,
) {
  const transition = shallowRef<{ from: P; direction: "forward" | "back" }>();
  const returningFrom = shallowRef<P>();
  let media: MediaQueryList | undefined;
  let animations: Animation[] = [];
  let generation = 0;
  function cancel() {
    generation++;
    for (const animation of animations) animation.cancel();
    animations = [];
    transition.value = undefined;
  }
  function preferenceChanged() {
    if (media?.matches) cancel();
  }
  onMounted(() => {
    media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    media?.addEventListener?.("change", preferenceChanged);
  });
  onBeforeUnmount(() => {
    cancel();
    media?.removeEventListener?.("change", preferenceChanged);
  });
  watch(source, async (next, previous) => {
    const from = previous.pages.at(-1);
    const to = next.pages.at(-1);
    const sameLayout =
      next.layoutKey === previous.layoutKey &&
      next.enabled === previous.enabled;
    if (sameLayout && from?.key === to?.key) return;
    cancel();
    const turn = generation;
    const locate = (pages: readonly P[]) => ({
      viewId: "",
      keys: pages.map(({ key }) => key),
    });
    const direction =
      sameLayout &&
      from &&
      to &&
      pageMotionDirection(locate(previous.pages), locate(next.pages));
    returningFrom.value =
      direction === "back" && document.activeElement?.matches(":focus-visible")
        ? previous.pages[next.pages.length]
        : undefined;
    if (
      !next.enabled ||
      !direction ||
      !from ||
      !to ||
      canAnimate?.(from, to) === false ||
      media?.matches ||
      typeof Element.prototype.animate !== "function"
    )
      return;
    transition.value = { from, direction };
    await nextTick();
    if (turn !== generation) return;
    const [under, over] = surfaces();
    if (!under?.animate || !over?.animate) {
      cancel();
      return;
    }
    const run = (surface: HTMLElement, start: number, end: number) =>
      surface.animate(
        [
          { transform: `translateX(${start}%)` },
          { transform: `translateX(${end}%)` },
        ],
        { duration: 220, easing: "cubic-bezier(.22,.68,.24,1)", fill: "both" },
      );
    animations =
      direction === "forward"
        ? [run(under, 0, -18), run(over, 100, 0)]
        : [run(under, -18, 0), run(over, 0, 100)];
    try {
      await Promise.all(animations.map((animation) => animation.finished));
    } catch {
      // cancel() rejects finished; only this generation can clean up its surfaces.
    }
    if (turn === generation) cancel();
  });
  return { transition, returningFrom, cancel };
}
