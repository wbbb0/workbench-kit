import { shallowRef } from "vue";
import { canStartPointerDrag, usePointerDrag } from "./usePointerDrag.js";
export interface MarqueeRect { left: number; top: number; width: number; height: number }
export function useMarqueeSelection(options: { point: (event: PointerEvent) => { x: number; y: number }; hitTest: (rect: MarqueeRect) => string[]; selectedKeys: () => readonly string[]; onChange: (keys: string[]) => void }) {
  const rect = shallowRef<MarqueeRect | null>(null);
  const moved = shallowRef(false);
  const drag = usePointerDrag<{ x: number; y: number; base: string[]; original: string[] }>({
    onMove({ event, state }) {
      const point = options.point(event);
      if (!moved.value && Math.hypot(point.x - state.x, point.y - state.y) < 4) return;
      moved.value = true;
      rect.value = { left: Math.min(state.x, point.x), top: Math.min(state.y, point.y), width: Math.abs(state.x - point.x), height: Math.abs(state.y - point.y) };
      options.onChange([...new Set([...state.base, ...options.hitTest(rect.value)])]);
    },
    onEnd({ state, cancelled }) { rect.value = null; if (cancelled) { moved.value = false; options.onChange(state.original); } }
  });
  function start(event: PointerEvent) {
    if (event.pointerType === "touch" || !canStartPointerDrag(event)) return false;
    drag.stop();
    const point = options.point(event);
    moved.value = false;
    return drag.start(event, { ...point, original: [...options.selectedKeys()], base: event.ctrlKey || event.metaKey ? [...options.selectedKeys()] : [] });
  }
  return { rect, moved, start, stop: drag.stop };
}
