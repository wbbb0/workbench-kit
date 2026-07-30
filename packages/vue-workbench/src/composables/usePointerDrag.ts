import { onBeforeUnmount, readonly, shallowRef } from "vue";

export type PointerDragMove<TState> = {
  event: PointerEvent;
  state: TState;
  deltaX: number;
  deltaY: number;
};

export type PointerDragEnd<TState> = {
  event?: PointerEvent;
  state: TState;
  cancelled: boolean;
};

export type PointerDragOptions<TState> = {
  onMove: (move: PointerDragMove<TState>) => void;
  onEnd?: (end: PointerDragEnd<TState>) => void;
  cursor?: string | ((state: TState) => string);
};

type ActivePointerDrag<TState> = {
  pointerId: number;
  startX: number;
  startY: number;
  target: HTMLElement;
  state: TState;
};

export function canStartPointerDrag(event: PointerEvent) {
  return event.isPrimary !== false && event.button === 0;
}

export function usePointerDrag<TState>(options: PointerDragOptions<TState>) {
  const activeState = shallowRef<TState | null>(null);
  let active: ActivePointerDrag<TState> | null = null;
  let cursorStyle: HTMLStyleElement | null = null;

  function removeCursorStyle() {
    cursorStyle?.remove();
    cursorStyle = null;
  }

  function applyCursorStyle(state: TState) {
    const cursor = typeof options.cursor === "function" ? options.cursor(state) : options.cursor;
    if (!cursor || typeof document === "undefined") {
      return;
    }
    cursorStyle = document.createElement("style");
    cursorStyle.dataset.workbenchPointerDragCursor = "";
    cursorStyle.textContent = `*, *::before, *::after { cursor: ${cursor} !important; }`;
    document.head.appendChild(cursorStyle);
  }

  function removeListeners() {
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
    window.removeEventListener("pointercancel", handlePointerCancel);
    window.removeEventListener("blur", handleWindowBlur);
    active?.target.removeEventListener("lostpointercapture", handleLostPointerCapture);
  }

  function finish(event: PointerEvent | undefined, cancelled: boolean) {
    const completed = active;
    if (!completed) {
      return;
    }
    removeListeners();
    removeCursorStyle();
    active = null;
    activeState.value = null;
    if (completed.target.hasPointerCapture?.(completed.pointerId)) {
      completed.target.releasePointerCapture(completed.pointerId);
    }
    options.onEnd?.({
      event,
      state: completed.state,
      cancelled
    });
  }

  function handlePointerMove(event: PointerEvent) {
    if (!active || event.pointerId !== active.pointerId) {
      return;
    }
    event.preventDefault();
    options.onMove({
      event,
      state: active.state,
      deltaX: event.clientX - active.startX,
      deltaY: event.clientY - active.startY
    });
  }

  function handlePointerUp(event: PointerEvent) {
    if (!active || event.pointerId !== active.pointerId) {
      return;
    }
    finish(event, false);
  }

  function handlePointerCancel(event: PointerEvent) {
    if (!active || event.pointerId !== active.pointerId) {
      return;
    }
    finish(event, true);
  }

  function handleLostPointerCapture(event: PointerEvent) {
    if (!active || event.pointerId !== active.pointerId) {
      return;
    }
    finish(event, true);
  }

  function handleWindowBlur() {
    finish(undefined, true);
  }

  function start(event: PointerEvent, state: TState) {
    if (!canStartPointerDrag(event)) {
      return false;
    }
    const target = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    if (!target) {
      return false;
    }
    finish(undefined, true);
    event.preventDefault();
    active = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      target,
      state
    };
    activeState.value = state;
    applyCursorStyle(state);
    target.addEventListener("lostpointercapture", handleLostPointerCapture);
    target.setPointerCapture?.(event.pointerId);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);
    window.addEventListener("blur", handleWindowBlur);
    return true;
  }

  function stop() {
    finish(undefined, true);
  }

  onBeforeUnmount(stop);

  return {
    activeState: readonly(activeState),
    start,
    stop
  };
}
