import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import WindowSurface from "./WindowSurface.vue";
import type { WorkbenchRuntimeWindow } from "./useWorkbenchWindows.js";

function makeWindow(fullscreen?: boolean): WorkbenchRuntimeWindow {
  return { id: "test", definition: { kind: "dialog", title: "Tool", size: "full", mobileFullscreen: fullscreen }, position: { x: 80, y: 20 }, sizePx: { width: 640, height: 420 }, order: 1, maximized: false } as WorkbenchRuntimeWindow;
}
describe("mobile fullscreen windows", () => {
  it("retains legacy mobile sizing unless explicitly enabled", () => {
    const wrapper = mount(WindowSurface, { props: { window: makeWindow(), isMobile: true } });
    expect((wrapper.element as HTMLElement).style.transform).toContain("80px");
    expect((wrapper.element as HTMLElement).style.width).toBe("640px");
    wrapper.unmount();
  });
  it("ignores desktop bounds in mobile fullscreen and restores them afterwards", async () => {
    const window = makeWindow(true);
    const wrapper = mount(WindowSurface, { props: { window, isMobile: true } });
    expect((wrapper.element as HTMLElement).style.transform).toBe("none");
    expect((wrapper.element as HTMLElement).style.left).toBe("0px");
    expect(wrapper.find('[data-window-resize-handle]').exists()).toBe(false);
    await wrapper.setProps({ isMobile: false });
    expect((wrapper.element as HTMLElement).style.width).toBe("640px");
    expect((wrapper.element as HTMLElement).style.transform).toContain("80px");
    expect(window.position).toEqual({ x: 80, y: 20 });
    wrapper.unmount();
  });
});
