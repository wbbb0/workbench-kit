import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import DialogRenderer from "../windows/DialogRenderer.vue";
import { createWorkbenchWindowService } from "../windows/windowService.js";
import { createWorkbenchErrors } from "./useWorkbenchErrors.js";

describe("workbench error windows", () => {
  it("focuses repeated errors across presenters while unrelated windows remain independent", () => {
    const windows = createWorkbenchWindowService();
    windows.openDialogSync({ title: "Existing tool", size: "lg" });
    const focus = vi.spyOn(windows, "focus");
    const errors = createWorkbenchErrors(windows);
    const otherPresenter = createWorkbenchErrors(windows);
    const info = { code: "BUSY", message: "In use", requestId: "first-request" };
    const id = errors.show(info);
    expect(otherPresenter.show({ ...info, requestId: "second-request" })).toBe(id);
    expect(otherPresenter.show({ code: "WRAPPED", message: "Another wrapper", requestId: "first-request" })).toBe(id);
    expect(focus).toHaveBeenCalledTimes(2);
    expect(windows.snapshot()).toHaveLength(2);
    expect(windows.snapshot()[0]!.definition.title).toBe("Existing tool");
    const another = errors.show({ code: "NOT_FOUND", message: "Missing" });
    expect(another).not.toBe(id);
    windows.close(id, { reason: "close", values: {} });
    expect(errors.show(info)).not.toBe(id);
  });

  it("uses an optional grouping key, preserves the original snapshot, and acknowledges with one button", () => {
    const windows = createWorkbenchWindowService();
    const errors = createWorkbenchErrors(windows);
    const original = { message: "Original", title: "Original title" };
    const id = errors.show(original, { id: "save", title: "Save failed" });
    original.message = "Changed by caller";
    expect(errors.show({ message: "Another failure" }, { id: "save" })).toBe(id);
    const definition = windows.get(id)!.definition;
    expect(definition.title).toBe("Save failed");
    expect(definition.size).toBe("auto");
    expect(definition.mobileFullscreen).toBeUndefined();
    expect(definition.actions).toEqual([]);
    const wrapper = mount(DialogRenderer, { props: { windowId: id, definition } });
    expect(wrapper.get('[role="alert"]').text()).toBe("Original");
    expect(wrapper.get('[data-action-kind="close"]').text()).toBe("知道了");
    expect(wrapper.findAll("[data-action-id]")).toHaveLength(0);
    wrapper.unmount();
  });

  it("keeps different explicit groups independent even when their reasons match", () => {
    const windows = createWorkbenchWindowService();
    const errors = createWorkbenchErrors(windows);
    const info = { code: "BUSY", message: "In use", requestId: "same-request" };
    const first = errors.show(info, { id: "task-first" });
    const second = errors.show(info, { id: "task-second" });
    const ungrouped = errors.show(info);
    expect(new Set([first, second, ungrouped]).size).toBe(3);
    expect(errors.show({ ...info, details: "Again" }, { id: "task-first" })).toBe(first);
  });

  it("retries only on a user action and keeps failed retries open with their failure reason", async () => {
    const windows = createWorkbenchWindowService();
    const retry = vi.fn().mockRejectedValueOnce(new Error("Still busy")).mockResolvedValueOnce(undefined);
    const id = createWorkbenchErrors(windows).show({ message: "Could not save", retryable: true }, { retry });
    const wrapper = mount(DialogRenderer, { props: { windowId: id, definition: windows.get(id)!.definition } });
    expect(retry).not.toHaveBeenCalled();
    await wrapper.get('[data-action-id="retry"]').trigger("click");
    await flushPromises();
    expect(retry).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain("重试未完成：Still busy");
    expect(wrapper.emitted("resolve")).toBeUndefined();
    expect(windows.get(id)).toBeDefined();
    await wrapper.get('[data-action-id="retry"]').trigger("click");
    await flushPromises();
    expect(retry).toHaveBeenCalledTimes(2);
    expect(wrapper.emitted("resolve")?.[0]?.[0]).toMatchObject({ reason: "action", actionId: "retry" });
    wrapper.unmount();
  });

  it("omits retry without a callback or when the caller marks the error non-retryable", () => {
    const windows = createWorkbenchWindowService();
    const errors = createWorkbenchErrors(windows);
    const noCallback = errors.show({ message: "No callback", retryable: true });
    const forbidden = errors.show({ message: "No retry", retryable: false }, { retry: vi.fn() });
    expect(windows.get(noCallback)!.definition.actions).toEqual([]);
    expect(windows.get(forbidden)!.definition.actions).toEqual([]);
  });

  it("displays structured retry failures without requiring a transport-specific Error subclass", async () => {
    const windows = createWorkbenchWindowService();
    const retry = vi.fn().mockRejectedValue({ code: "BUSY", message: "The resource is still locked" });
    const id = createWorkbenchErrors(windows).show({ message: "Retry failed" }, { retry });
    const wrapper = mount(DialogRenderer, { props: { windowId: id, definition: windows.get(id)!.definition } });
    await wrapper.get('[data-action-id="retry"]').trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("The resource is still locked");
    expect(wrapper.emitted("resolve")).toBeUndefined();
    wrapper.unmount();
  });
});
