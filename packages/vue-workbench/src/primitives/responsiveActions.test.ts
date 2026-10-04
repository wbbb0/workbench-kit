import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { fitToolbarActions } from "./actionToolbarTypes.js";
import WorkbenchBreadcrumbs from "./WorkbenchBreadcrumbs.vue";
import WorkbenchDynamicTabs from "./WorkbenchDynamicTabs.vue";
import WorkbenchTaskList from "./WorkbenchTaskList.vue";

describe("responsive toolbar", () => {
  const actions = [{ id: "first", label: "First" }, { id: "important", label: "Important", priority: 10 }, { id: "last", label: "Last" }];
  it("preserves all actions when space is sufficient", () => {
    expect([...fitToolbarActions(actions, [60, 80, 60], 208, 32)]).toEqual(["first", "important", "last"]);
  });
  it("reserves room for more and keeps the highest priority action", () => {
    expect([...fitToolbarActions(actions, [60, 80, 60], 120, 32)]).toEqual(["important"]);
    expect([...fitToolbarActions(actions, [60, 80, 60], 32, 32)]).toEqual([]);
  });
});

describe("breadcrumbs", () => {
  const items = ["Root", "One", "Two", "Current"].map(label => ({ label, href: `/${label}` }));
  it("preserves the old complete breadcrumb without requiring a runtime", () => {
    const wrapper = mount(WorkbenchBreadcrumbs, { props: { items } });
    expect(wrapper.findAll("a").length).toBe(4);
    expect(wrapper.find("button").exists()).toBe(false);
  });
  it("keeps root and current location when intermediate ancestors collapse", () => {
    const wrapper = mount(WorkbenchBreadcrumbs, { props: { items, maxItems: 2 } });
    expect(wrapper.findAll("a").map(link => link.text())).toEqual(["Root", "Current"]);
    expect(wrapper.find('[aria-haspopup="menu"]').exists()).toBe(true);
  });
});

describe("dynamic tabs", () => {
  const items = [{ id: "one", label: "One", closable: true }, { id: "disabled", label: "Disabled", closable: true, disabled: true }];
  it("keeps selection and close as separate controls", async () => {
    const wrapper = mount(WorkbenchDynamicTabs, { props: { items, modelValue: "one" } });
    expect(wrapper.find("button button").exists()).toBe(false);
    await wrapper.get('[aria-pressed="true"]').trigger("click");
    await wrapper.get('[aria-label="Close One"]').trigger("click");
    expect(wrapper.emitted("update:modelValue")).toEqual([["one"]]);
    expect(wrapper.emitted("close")).toEqual([["one"]]);
    expect((wrapper.get('[aria-label="Close Disabled"]').element as HTMLButtonElement).disabled).toBe(true);
  });
  it("adds explicit compact controls without removing desktop controls", () => {
    const wrapper = mount(WorkbenchDynamicTabs, { props: { items, modelValue: "one", compact: true, addable: true } });
    expect(wrapper.find(".workbench-dynamic-tabs-compact").text()).toContain("One");
    expect(wrapper.find(".workbench-dynamic-tabs-expanded").exists()).toBe(true);
  });
});

describe("tasks", () => {
  it("only exposes cancel and retry for appropriate task states", async () => {
    const wrapper = mount(WorkbenchTaskList, { props: { tasks: [
      { id: "running", label: "Upload", status: "running", completed: 12, total: 10, cancellable: true },
      { id: "failed", label: "Copy", status: "failed", error: "Permission denied", retryable: true },
      { id: "done", label: "Done", status: "completed", cancellable: true, retryable: true }
    ] } });
    const buttons = wrapper.findAll("button");
    expect(buttons).toHaveLength(2);
    await buttons[0]!.trigger("click");
    await buttons[1]!.trigger("click");
    expect(wrapper.emitted("cancel")).toEqual([["running"]]);
    expect(wrapper.emitted("retry")).toEqual([["failed"]]);
    expect(wrapper.get("progress").attributes("value")).toBe("10");
    expect(wrapper.get('[role="alert"]').text()).toBe("Permission denied");
  });
});
