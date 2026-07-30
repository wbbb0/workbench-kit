import { mount } from "@vue/test-utils";
import { beforeAll, describe, expect, it } from "vitest";
import ResponsiveSplitPaneGroup from "./ResponsiveSplitPaneGroup.vue";

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    disconnect() {}
    unobserve() {}
  };
});

describe("ResponsiveSplitPaneGroup active pane state", () => {
  it("keeps the horizontal grid height definite for pane-local vertical scrolling", () => {
    const wrapper = mount(ResponsiveSplitPaneGroup, {
      props: {
        panes: [
          { id: "one", label: "One" },
          { id: "two", label: "Two" }
        ]
      }
    });
    const layout = wrapper.find(".relative.isolate.grid");
    expect(layout.attributes("style")).toContain("height: 100%");
    expect(layout.attributes("style")).not.toContain("min-height: 100%");
  });

  it("falls back from an invalid controlled id without taking control", () => {
    const wrapper = mount(ResponsiveSplitPaneGroup, {
      props: {
        panes: [
          { id: "one", label: "One" },
          { id: "two", label: "Two" }
        ],
        activePaneId: "missing"
      }
    });
    expect(wrapper.emitted("update:activePaneId")?.[0]).toEqual(["one"]);
  });

  it("does not activate tabDisabled panes and falls back after removal", async () => {
    const wrapper = mount(ResponsiveSplitPaneGroup, {
      props: {
        panes: [
          { id: "one", label: "One" },
          { id: "two", label: "Two", tabDisabled: true }
        ],
        defaultActivePaneId: "two"
      }
    });
    expect(wrapper.emitted("update:activePaneId")?.[0]).toEqual(["one"]);
    const vm = wrapper.vm as unknown as { activatePane: (paneId: string) => boolean };
    expect(vm.activatePane("two")).toBe(false);

    await wrapper.setProps({
      panes: [
        { id: "three", label: "Three" },
        { id: "two", label: "Two", tabDisabled: true }
      ]
    });
    expect(wrapper.emitted("update:activePaneId")?.at(-1)).toEqual(["three"]);
  });
});
