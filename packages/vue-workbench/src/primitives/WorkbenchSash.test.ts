import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import WorkbenchSash from "./WorkbenchSash.vue";

describe("WorkbenchSash", () => {
  it("renders a complete separator range and forwards interactions", async () => {
    const wrapper = mount(WorkbenchSash, {
      props: {
        orientation: "vertical",
        label: "Resize Files and Editor",
        valueNow: 320,
        valueMin: 200,
        valueMax: 600,
        valueText: "320 pixels"
      }
    });
    expect(wrapper.attributes("role")).toBe("separator");
    expect(wrapper.attributes("aria-valuenow")).toBe("320");
    expect(wrapper.attributes("aria-valuemin")).toBe("200");
    expect(wrapper.attributes("aria-valuemax")).toBe("600");
    await wrapper.trigger("pointerdown", { pointerId: 1, button: 0, isPrimary: true });
    await wrapper.trigger("keydown", { key: "ArrowRight" });
    await wrapper.trigger("dblclick");
    expect(wrapper.emitted("pointerdown")).toHaveLength(1);
    expect(wrapper.emitted("keydown")).toHaveLength(1);
    expect(wrapper.emitted("dblclick")).toHaveLength(1);
  });
});
