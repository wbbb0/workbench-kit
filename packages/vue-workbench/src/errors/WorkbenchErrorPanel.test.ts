import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import WorkbenchErrorPanel from "./WorkbenchErrorPanel.vue";
import { formatWorkbenchError } from "./types.js";

const info = { code: "BUSY", message: "The item is in use.", hint: "Close its editor.", requestId: "request-1", details: "<script>technical detail</script>" };
afterEach(() => vi.unstubAllGlobals());

describe("WorkbenchErrorPanel", () => {
  it("renders reason and hint as text, and keeps technical details optional", () => {
    const wrapper = mount(WorkbenchErrorPanel, { props: { info } });
    expect(wrapper.get('[role="alert"]').text()).toBe(info.message);
    expect(wrapper.text()).toContain(info.hint);
    expect(wrapper.get("details").attributes("open")).toBeUndefined();
    expect(wrapper.find("script").exists()).toBe(false);
    wrapper.unmount();
    const minimal = mount(WorkbenchErrorPanel, { props: { info: { message: "Failed" } } });
    expect(minimal.find("details").exists()).toBe(false);
    expect(minimal.find("dl").exists()).toBe(false);
    minimal.unmount();
  });

  it("copies the structured diagnostic information when permitted", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const wrapper = mount(WorkbenchErrorPanel, { props: { info } });
    await wrapper.get("button").trigger("click");
    await flushPromises();
    expect(writeText).toHaveBeenCalledWith(formatWorkbenchError(info));
    expect(wrapper.get('[role="status"]').text()).toBe("已复制");
    expect(wrapper.find("textarea").exists()).toBe(false);
    wrapper.unmount();
  });

  it("offers selectable text when clipboard access is rejected or unavailable", async () => {
    for (const clipboard of [{ writeText: vi.fn().mockRejectedValue(new Error("denied")) }, undefined]) {
      vi.stubGlobal("navigator", { clipboard });
      const wrapper = mount(WorkbenchErrorPanel, { props: { info } });
      await wrapper.get("button").trigger("click");
      await flushPromises();
      const textarea = wrapper.get("textarea").element as HTMLTextAreaElement;
      expect(textarea.readOnly).toBe(true);
      expect(textarea.value).toBe(formatWorkbenchError(info));
      expect(textarea.selectionStart).toBe(0);
      expect(textarea.selectionEnd).toBe(textarea.value.length);
      expect(wrapper.get('[role="status"]').text()).toContain("无法访问剪贴板");
      wrapper.unmount();
    }
  });
});
