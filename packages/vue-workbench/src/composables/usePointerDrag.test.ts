import { mount } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import { describe, expect, it, vi } from "vitest";
import { usePointerDrag } from "./usePointerDrag";

function pointerEvent(type: string, init: PointerEventInit) {
  return new PointerEvent(type, { bubbles: true, ...init });
}

describe("usePointerDrag", () => {
  it("tracks one pointer and reports pointercancel", async () => {
    const onMove = vi.fn();
    const onEnd = vi.fn();
    const Harness = defineComponent({
      setup() {
        const drag = usePointerDrag<{ id: string }>({ onMove, onEnd, cursor: "col-resize" });
        return () => h("button", {
          onPointerdown: (event: PointerEvent) => drag.start(event, { id: "pane" })
        });
      }
    });
    const wrapper = mount(Harness, { attachTo: document.body });
    const button = wrapper.get("button").element;
    button.dispatchEvent(pointerEvent("pointerdown", {
      pointerId: 7,
      button: 0,
      isPrimary: true,
      clientX: 10,
      clientY: 20
    }));
    window.dispatchEvent(pointerEvent("pointermove", {
      pointerId: 7,
      clientX: 35,
      clientY: 50
    }));
    expect(onMove).toHaveBeenCalledWith(expect.objectContaining({
      deltaX: 25,
      deltaY: 30,
      state: { id: "pane" }
    }));
    expect(document.querySelector("style[data-workbench-pointer-drag-cursor]")).not.toBeNull();
    window.dispatchEvent(pointerEvent("pointercancel", { pointerId: 7 }));
    expect(onEnd).toHaveBeenCalledWith(expect.objectContaining({
      cancelled: true,
      state: { id: "pane" }
    }));
    expect(document.querySelector("style[data-workbench-pointer-drag-cursor]")).toBeNull();
    wrapper.unmount();
  });

  it("ignores secondary mouse buttons", () => {
    const onMove = vi.fn();
    let started: boolean | undefined;
    const Harness = defineComponent({
      setup() {
        const drag = usePointerDrag({ onMove });
        return () => h("button", {
          onPointerdown: (event: PointerEvent) => {
            started = drag.start(event, {});
          }
        });
      }
    });
    const wrapper = mount(Harness);
    wrapper.get("button").element.dispatchEvent(pointerEvent("pointerdown", {
      pointerId: 1,
      button: 2,
      isPrimary: true
    }));
    expect(started).toBe(false);
  });

  it("cancels on lost pointer capture and component unmount", () => {
    const onEnd = vi.fn();
    const Harness = defineComponent({
      setup() {
        const drag = usePointerDrag({ onMove: () => {}, onEnd });
        return () => h("button", {
          onPointerdown: (event: PointerEvent) => drag.start(event, { id: "pane" })
        });
      }
    });
    const wrapper = mount(Harness);
    const button = wrapper.get("button").element;
    button.dispatchEvent(pointerEvent("pointerdown", {
      pointerId: 3,
      button: 0,
      isPrimary: true
    }));
    button.dispatchEvent(pointerEvent("lostpointercapture", {
      pointerId: 3,
      isPrimary: true
    }));
    expect(onEnd).toHaveBeenLastCalledWith(expect.objectContaining({ cancelled: true }));

    button.dispatchEvent(pointerEvent("pointerdown", {
      pointerId: 4,
      button: 0,
      isPrimary: true
    }));
    wrapper.unmount();
    expect(onEnd).toHaveBeenCalledTimes(2);
    expect(onEnd).toHaveBeenLastCalledWith(expect.objectContaining({ cancelled: true }));
  });
});
