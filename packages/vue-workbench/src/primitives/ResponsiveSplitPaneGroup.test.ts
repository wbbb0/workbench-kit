import { mount } from "@vue/test-utils";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { defineComponent, h, onMounted, onUnmounted, ref } from "vue";
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


describe("ResponsiveSplitPaneGroup pane continuity", () => {
  it("preserves component instances and scrolling across desktop, compact tabs and stacked layouts", async () => {
    let mounted = 0;
    let unmounted = 0;
    const StatefulPane = defineComponent({
      setup() {
        const count = ref(0);
        onMounted(() => mounted++);
        onUnmounted(() => unmounted++);
        return () => h("div", { class: "pane-scroll", style: "overflow:auto;height:100%" }, [h("button", { onClick: () => count.value++ }, String(count.value))]);
      }
    });
    const wrapper = mount(ResponsiveSplitPaneGroup, {
      props: { panes: [{ id: "one" }, { id: "two" }], breakpoint: 760 },
      slots: { one: () => h(StatefulPane), two: () => h(StatefulPane) }
    });
    let width = 1000;
    vi.spyOn(wrapper.element, "getBoundingClientRect").mockImplementation(() => ({ width, height: 600 }) as DOMRect);
    // breakpoint updates remeasure the container just like ResizeObserver.
    await wrapper.setProps({ breakpoint: 761 });
    const original = wrapper.get(".pane-scroll").element as HTMLElement;
    original.scrollTop = 125;
    await wrapper.get(".pane-scroll button").trigger("click");
    width = 375;
    await wrapper.setProps({ breakpoint: 760 });
    expect(wrapper.find('[role="tabpanel"]').exists()).toBe(true);
    expect(wrapper.get(".pane-scroll").element).toBe(original);
    expect(original.scrollTop).toBe(125);
    expect(wrapper.get(".pane-scroll button").text()).toBe("1");
    await wrapper.setProps({ compactMode: "stacked" });
    expect(wrapper.get(".pane-scroll").element).toBe(original);
    width = 1200;
    await wrapper.setProps({ breakpoint: 762 });
    expect(wrapper.get(".pane-scroll").element).toBe(original);
    expect(mounted).toBe(2);
    expect(unmounted).toBe(0);
    wrapper.unmount();
  });
});
