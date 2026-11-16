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
    expect(wrapper.get('[role="dialog"]').attributes("aria-label")).toBe("Tool");
    expect(wrapper.get('[role="dialog"]').attributes("aria-modal")).toBe("false");
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

it("可选按钮与双击共用最大化状态，移动端隐藏按钮", async () => {
  const window = makeWindow(true);
  window.definition.showMaximizeButton = true;
  const wrapper = mount(WindowSurface, { props: { window, isMobile: false } });
  await wrapper.get('[aria-label="最大化"]').trigger("click");
  const payload = wrapper.emitted("maximize")![0]![0] as { bounds: WorkbenchRuntimeWindow["restoreBounds"]; restoreBounds: WorkbenchRuntimeWindow["restoreBounds"] };
  expect(payload.restoreBounds).toEqual({ position: { x: 80, y: 20 }, sizePx: { width: 640, height: 420 } });
  await wrapper.setProps({ window: { ...window, maximized: true, restoreBounds: payload.restoreBounds } });
  await wrapper.get('[aria-label="还原"]').trigger("click");
  expect(wrapper.emitted("maximize")![1]![0]).toMatchObject({ maximized: false, bounds: payload.restoreBounds });
  await wrapper.setProps({ isMobile: true });
  expect(wrapper.find('[aria-label="还原"]').exists()).toBe(false);
  wrapper.unmount();
});

it("活动模态窗口限制焦点且 Enter 不触发动作，失活后释放焦点", async () => {
  const window = makeWindow();
  window.definition.modal = true;
  window.definition.trapFocus = true;
  const outside = document.createElement("button");
  document.body.append(outside);
  const wrapper = mount(WindowSurface, { props: { window, isMobile: false }, attachTo: document.body, slots: { default: '<button id="last">操作</button>' } });
  expect(document.activeElement).toBe(wrapper.element);
  await wrapper.trigger("keydown", { key: "Enter" });
  expect(wrapper.emitted("close")).toBeUndefined();
  await wrapper.trigger("keydown", { key: "Tab" });
  expect(document.activeElement).toBe(wrapper.get('[aria-label="关闭"]').element);
  await wrapper.get('[aria-label="关闭"]').trigger("keydown", { key: "Tab", shiftKey: true });
  expect(document.activeElement).toBe(wrapper.get("#last").element);
  outside.focus();
  expect(document.activeElement).toBe(wrapper.element);
  await wrapper.setProps({ inactive: true });
  outside.focus();
  expect(document.activeElement).toBe(outside);
  wrapper.unmount(); outside.remove();
});
