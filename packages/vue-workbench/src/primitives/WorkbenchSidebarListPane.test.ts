import { defineComponent, h, markRaw } from "vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import WorkbenchSidebarListPane from "./WorkbenchSidebarListPane.vue";
import WorkbenchListItem from "./WorkbenchListItem.vue";
import type { WorkbenchSidebarListItem } from "./sidebarListTypes.js";

const DummyIcon = markRaw(
  defineComponent({
    name: "DummyIcon",
    setup: () => () => h("svg", { "data-testid": "item-icon" }),
  }),
);

describe("WorkbenchSidebarListPane", () => {
  it("内置列表容器模式默认渲染带分割线的列表项并触发选择", async () => {
    const items: WorkbenchSidebarListItem[] = [
      {
        id: "a",
        title: "第一项",
        subtitle: "说明",
        meta: "2",
        icon: DummyIcon,
        disclosure: true,
        selected: true,
        ariaCurrent: "page",
        attrs: { "data-item-id": "a" },
      },
      {
        id: "b",
        title: "第二项",
        disabled: true,
      },
    ];
    const wrapper = mount(WorkbenchSidebarListPane, {
      props: {
        showHeader: false,
        ariaLabel: "导航列表",
        role: "navigation",
        items,
      },
    });
    try {
      const region = wrapper.get('[aria-label="导航列表"]');
      expect(region.attributes("role")).toBe("navigation");
      const rows = region.findAllComponents(WorkbenchListItem);
      expect(rows).toHaveLength(2);
      expect(rows[0]!.classes()).toContain("border-b");
      expect(rows[0]!.classes()).toContain("is-selected");
      expect(rows[0]!.attributes("aria-current")).toBe("page");
      expect(rows[0]!.attributes("data-item-id")).toBe("a");
      expect(rows[0]!.find('[data-testid="item-icon"]').exists()).toBe(true);
      expect(rows[0]!.text()).toContain("第一项");
      expect(rows[0]!.text()).toContain("说明");
      expect(rows[0]!.text()).toContain("2");
      expect(rows[1]!.attributes("disabled")).toBeDefined();

      await rows[0]!.trigger("click");
      await rows[1]!.trigger("click");
      expect(wrapper.emitted("select")).toEqual([[items[0], 0]]);
    } finally {
      wrapper.unmount();
    }
  });

  it("未传 items 时作为自定义内容容器渲染默认插槽且不显示空列表提示", () => {
    const wrapper = mount(WorkbenchSidebarListPane, {
      props: { showHeader: false },
      slots: {
        default: () => h("div", { "data-testid": "custom-pane" }, "自定义内容"),
      },
    });
    try {
      expect(wrapper.find('[data-testid="custom-pane"]').exists()).toBe(true);
      expect(wrapper.text()).not.toContain("暂无数据");
    } finally {
      wrapper.unmount();
    }
  });

  it("同时提供 items 与默认插槽时先渲染列表再将自定义内容附加在最后", () => {
    const wrapper = mount(WorkbenchSidebarListPane, {
      props: {
        showHeader: false,
        items: [{ id: "only", title: "列表条目" }],
      },
      slots: {
        default: () => h("section", { "data-testid": "trailing-section" }, "附加栏"),
      },
    });
    try {
      const scroll = wrapper.get(".overflow-y-auto");
      const children = Array.from(scroll.element.children);
      expect(children).toHaveLength(2);
      expect(children[0]!.textContent).toContain("列表条目");
      expect(children[1]!.getAttribute("data-testid")).toBe("trailing-section");
    } finally {
      wrapper.unmount();
    }
  });
});
