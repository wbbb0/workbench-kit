import { mount } from "@vue/test-utils";
import { beforeAll, describe, expect, it } from "vitest";
import ResponsiveSplitPane from "./ResponsiveSplitPane.vue";
import ResponsiveSplitPaneGroup from "./ResponsiveSplitPaneGroup.vue";

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    disconnect() {}
    unobserve() {}
  };
});

describe("ResponsiveSplitPane compatibility wrapper", () => {
  it("maps legacy shape props and primaryPosition into the group", () => {
    const wrapper = mount(ResponsiveSplitPane, {
      attrs: { class: "consumer-class", "data-layout": "test" },
      props: {
        primaryPosition: "end",
        primaryTitle: "Files",
        secondaryTitle: "Editor",
        defaultPrimarySize: 320,
        defaultStackedPrimarySize: 180,
        minPrimarySize: 240,
        minSecondarySize: 360,
        compactMode: "stacked"
      },
      slots: {
        primary: '<div class="primary-slot">Primary</div>',
        secondary: '<div class="secondary-slot">Secondary</div>'
      }
    });
    const group = wrapper.findComponent(ResponsiveSplitPaneGroup);
    expect(group.props("compactMode")).toBe("stacked");
    expect(group.props("panes")).toEqual([
      expect.objectContaining({ id: "secondary", label: "Editor", minSize: 360 }),
      expect.objectContaining({
        id: "primary",
        label: "Files",
        defaultSize: 320,
        defaultCompactSize: 180,
        minSize: 240
      })
    ]);
    expect(group.classes()).toContain("consumer-class");
    expect(group.attributes("data-layout")).toBe("test");
    expect(wrapper.find(".primary-slot").exists()).toBe(true);
    expect(wrapper.find(".secondary-slot").exists()).toBe(true);
  });

  it("defaults compact behavior to tabs", () => {
    const wrapper = mount(ResponsiveSplitPane);
    expect(wrapper.findComponent(ResponsiveSplitPaneGroup).props("compactMode")).toBe("tabs");
  });
});
