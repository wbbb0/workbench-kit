import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import WorkbenchTabStrip from "./WorkbenchTabStrip.vue";

const items = [
  { id: "one", label: "One" },
  { id: "two", label: "Two", disabled: true },
  { id: "three", label: "Three" }
];

describe("WorkbenchTabStrip", () => {
  it("keeps a valid selected tab in the roving tab order", () => {
    const wrapper = mount(WorkbenchTabStrip, {
      props: { items, modelValue: "three" }
    });
    const tabs = wrapper.findAll('[role="tab"]');
    expect(tabs[2]?.attributes("aria-selected")).toBe("true");
    expect(tabs[2]?.attributes("tabindex")).toBe("0");
  });

  it("falls back focus without selecting or emitting for an invalid model value", () => {
    const wrapper = mount(WorkbenchTabStrip, {
      props: { items, modelValue: "missing" }
    });
    const tabs = wrapper.findAll('[role="tab"]');
    expect(tabs[0]?.attributes("tabindex")).toBe("0");
    expect(tabs.every((tab) => tab.attributes("aria-selected") === "false")).toBe(true);
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
  });

  it("skips disabled tabs during keyboard navigation", async () => {
    const wrapper = mount(WorkbenchTabStrip, {
      attachTo: document.body,
      props: { items, modelValue: "one" }
    });
    await wrapper.findAll('[role="tab"]')[0]?.trigger("keydown", { key: "ArrowRight" });
    expect(wrapper.emitted("update:modelValue")?.[0]).toEqual(["three"]);
    wrapper.unmount();
  });
});
