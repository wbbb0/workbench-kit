import { mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WorkbenchDynamicTabs from "./WorkbenchDynamicTabs.vue";

const { openMenu } = vi.hoisted(() => ({ openMenu: vi.fn() }));
vi.mock("../menu/useMenuRuntime.js", () => ({ useMenuRuntime: () => ({ openMenu }) }));

const items = [
  { id: "one", label: "One", closable: true },
  { id: "two", label: "Two", closable: true },
  { id: "locked", label: "Locked", disabled: true, closable: true }
];
const wrappers: VueWrapper[] = [];
beforeEach(() => openMenu.mockReset());
afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()));
function render(props = {}) {
  const wrapper = mount(WorkbenchDynamicTabs, { props: { items, modelValue: "one", addable: true, ...props } });
  wrappers.push(wrapper);
  return wrapper;
}

describe("WorkbenchDynamicTabs appearance", () => {
  it("retains the rounded default and can opt in and out of adjacent editor tabs", async () => {
    const wrapper = render();
    expect(wrapper.classes()).not.toContain("is-editor");
    expect(wrapper.get(".workbench-dynamic-tab").classes()).toContain("rounded-md");
    expect(wrapper.get(".workbench-dynamic-tabs-expanded").classes()).toContain("gap-1");
    await wrapper.setProps({ appearance: "editor" });
    expect(wrapper.classes()).toContain("is-editor");
    expect(wrapper.get(".workbench-dynamic-tab").classes()).not.toContain("rounded-md");
    expect(wrapper.get(".workbench-dynamic-tabs-expanded").classes()).toContain("gap-0");
    expect(wrapper.findAll(".workbench-editor-tab.is-active")).toHaveLength(1);
    await wrapper.setProps({ modelValue: "two" });
    expect(wrapper.get(".workbench-editor-tab.is-active").text()).toBe("Two");
    await wrapper.setProps({ appearance: "default" });
    expect(wrapper.find(".workbench-editor-tab").exists()).toBe(false);
    expect(wrapper.get(".workbench-dynamic-tab").classes()).toContain("rounded-md");
  });

  it("keeps select, close, context, add, disabled, and reorder interactions in editor appearance", async () => {
    const wrapper = render({ appearance: "editor", draggable: true });
    const tabs = wrapper.findAll(".workbench-dynamic-tab");
    await tabs[1]!.get("button").trigger("click");
    expect(wrapper.emitted("update:modelValue")).toEqual([["two"]]);
    await tabs[0]!.get('[aria-label="Close One"]').trigger("click");
    expect(wrapper.emitted("close")).toEqual([["one"]]);
    expect(wrapper.emitted("update:modelValue")).toHaveLength(1);
    await tabs[2]!.get("button").trigger("click");
    await tabs[2]!.get('[aria-label="Close Locked"]').trigger("click");
    expect(wrapper.emitted("update:modelValue")).toHaveLength(1);
    expect(wrapper.emitted("close")).toHaveLength(1);
    expect(tabs[2]!.attributes("draggable")).toBe("false");
    await tabs[1]!.trigger("contextmenu");
    expect(wrapper.emitted("context")?.[0]?.[0]).toBe("two");
    await wrapper.get(".workbench-dynamic-tabs-add").trigger("click");
    expect(wrapper.emitted("add")).toHaveLength(1);
    const dataTransfer = { setData: vi.fn(), getData: () => "one", effectAllowed: "" };
    await tabs[0]!.trigger("dragstart", { dataTransfer });
    await tabs[1]!.trigger("drop", { dataTransfer });
    expect(dataTransfer.effectAllowed).toBe("move");
    expect(wrapper.emitted("reorder")).toEqual([["one", "two"]]);
  });

  it("retains the compact tab menu, disabled actions, and close/add controls", async () => {
    const wrapper = render({ appearance: "editor", compact: true });
    const compact = wrapper.get(".workbench-dynamic-tabs-compact");
    expect(compact.get(".workbench-dynamic-tabs-current").classes()).toContain("workbench-editor-tab");
    await compact.get('[aria-haspopup="menu"]').trigger("click");
    const menu = openMenu.mock.calls[0]![0];
    expect(menu.items.slice(0, 3).map((item: { disabled?: boolean }) => item.disabled)).toEqual([undefined, undefined, true]);
    menu.items[1].onSelect();
    expect(wrapper.emitted("update:modelValue")).toEqual([["two"]]);
    await compact.get('[aria-label="Close One"]').trigger("click");
    await compact.get('[aria-label="Add"]').trigger("click");
    expect(wrapper.emitted("close")).toEqual([["one"]]);
    expect(wrapper.emitted("add")).toHaveLength(1);
  });
});
