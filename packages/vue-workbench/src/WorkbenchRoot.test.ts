import { defineComponent, h, markRaw } from "vue";
import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";
import WorkbenchRoot from "./WorkbenchRoot.vue";
import TopBar from "./TopBar.vue";
import type { WorkbenchTopbarMenu } from "./chrome";
import type { WorkbenchNavItem } from "./navigation";
import { configureWorkbenchViewportDetector } from "./runtime/workbenchViewport";
import { defineWorkbenchView } from "./types";

const DummyIcon = markRaw(
  defineComponent({
    name: "DummyIcon",
    setup: () => () => h("svg"),
  }),
);

const DummyMain = markRaw(
  defineComponent({
    name: "DummyMain",
    setup: () => () => h("div", { "data-testid": "main-area" }, "主区域"),
  }),
);

const DummyStatusItem = markRaw(
  defineComponent({
    name: "DummyStatusItem",
    setup: () => () => h("span", { "data-testid": "status-item" }, "已连接"),
  }),
);

const baseView = defineWorkbenchView({
  id: "test",
  title: "测试工作台",
  areas: { mainArea: DummyMain },
});

const navItems: readonly WorkbenchNavItem[] = [
  { id: "test", title: "测试", icon: DummyIcon, placement: "primary" },
];

const sampleMenus: WorkbenchTopbarMenu[] = [
  {
    id: "view",
    label: "视图",
    resolveItems: () => [
      { kind: "action", id: "reload", label: "重新加载", onSelect: () => {} },
    ],
  },
];

const safeTopClass = "pt-[env(safe-area-inset-top,0px)]";

function useViewport(mobile: boolean) {
  configureWorkbenchViewportDetector({
    isMobile: () => mobile,
    subscribe: () => () => {},
  });
}

afterEach(() => {
  configureWorkbenchViewportDetector();
});

describe("WorkbenchRoot 顶栏开关", () => {
  it("桌面端默认隐藏空的顶栏并保留顶部安全区内边距", () => {
    useViewport(false);
    const wrapper = mount(WorkbenchRoot, {
      props: {
        view: baseView,
        navItems,
        activeNavItemId: "test",
        topbarMenus: [],
        statusbarItems: [{ id: "status", component: DummyStatusItem }],
      },
    });
    try {
      expect(wrapper.findComponent(TopBar).exists()).toBe(false);
      expect(wrapper.find("header").exists()).toBe(false);
      const column = wrapper.get("footer").element.parentElement!;
      expect(column.classList.contains(safeTopClass)).toBe(true);
      expect(wrapper.find("nav").exists()).toBe(true);
      expect(wrapper.find('[data-testid="main-area"]').exists()).toBe(true);
      expect(wrapper.find("footer").exists()).toBe(true);
    } finally {
      wrapper.unmount();
    }
  });

  it("桌面端显式关闭 hideEmptyTopbar 时即使菜单为空也渲染顶栏", () => {
    useViewport(false);
    const wrapper = mount(WorkbenchRoot, {
      props: {
        view: baseView,
        navItems,
        activeNavItemId: "test",
        topbarMenus: [],
        hideEmptyTopbar: false,
        statusbarItems: [],
      },
    });
    try {
      expect(wrapper.findComponent(TopBar).exists()).toBe(true);
      expect(wrapper.find("header").exists()).toBe(true);
      const column = wrapper.get("footer").element.parentElement!;
      expect(column.classList.contains(safeTopClass)).toBe(false);
    } finally {
      wrapper.unmount();
    }
  });

  it("桌面端默认配置下顶部菜单非空时显示顶栏及按钮", () => {
    useViewport(false);
    const wrapper = mount(WorkbenchRoot, {
      props: {
        view: baseView,
        navItems,
        activeNavItemId: "test",
        topbarMenus: sampleMenus,
        statusbarItems: [],
      },
    });
    try {
      expect(wrapper.findComponent(TopBar).exists()).toBe(true);
      const trigger = wrapper.find('[data-menu-trigger="topbar:view"]');
      expect(trigger.exists()).toBe(true);
      expect(trigger.text()).toBe("视图");
      const column = wrapper.get("footer").element.parentElement!;
      expect(column.classList.contains(safeTopClass)).toBe(false);
    } finally {
      wrapper.unmount();
    }
  });

  it("响应式切换 topbarMenus 与 hideEmptyTopbar 时顶栏同步显隐", async () => {
    useViewport(false);
    const wrapper = mount(WorkbenchRoot, {
      props: {
        view: baseView,
        navItems,
        activeNavItemId: "test",
        topbarMenus: [],
        statusbarItems: [],
      },
    });
    try {
      const column = () => wrapper.get("footer").element.parentElement!;
      expect(wrapper.findComponent(TopBar).exists()).toBe(false);
      expect(column().classList.contains(safeTopClass)).toBe(true);

      await wrapper.setProps({ topbarMenus: sampleMenus });
      expect(wrapper.findComponent(TopBar).exists()).toBe(true);
      expect(wrapper.find('[data-menu-trigger="topbar:view"]').exists()).toBe(
        true,
      );
      expect(column().classList.contains(safeTopClass)).toBe(false);

      await wrapper.setProps({ topbarMenus: [] });
      expect(wrapper.findComponent(TopBar).exists()).toBe(false);
      expect(column().classList.contains(safeTopClass)).toBe(true);

      await wrapper.setProps({ hideEmptyTopbar: false });
      expect(wrapper.findComponent(TopBar).exists()).toBe(true);
      expect(column().classList.contains(safeTopClass)).toBe(false);

      await wrapper.setProps({ hideEmptyTopbar: true });
      expect(wrapper.findComponent(TopBar).exists()).toBe(false);
      expect(column().classList.contains(safeTopClass)).toBe(true);
    } finally {
      wrapper.unmount();
    }
  });

  it("移动端在 topbarMenus 为空且默认 hideEmptyTopbar 时仍显示移动顶栏", () => {
    useViewport(true);
    const wrapper = mount(WorkbenchRoot, {
      props: {
        view: baseView,
        navItems,
        activeNavItemId: "test",
        topbarMenus: [],
        statusbarItems: [{ id: "status", component: DummyStatusItem }],
      },
    });
    try {
      expect(wrapper.findComponent(TopBar).exists()).toBe(false);
      const header = wrapper.find("header");
      expect(header.exists()).toBe(true);
      expect(header.text()).toContain("测试工作台");
      expect(header.find('[data-menu-trigger="mobile-workbench"]').exists()).toBe(
        true,
      );
    } finally {
      wrapper.unmount();
    }
  });
});

describe("WorkbenchRoot primarySidebar 模式", () => {
  it("支持仅内置列表与列表+自定义内容混合模式", async () => {
    useViewport(false);
    const clicks: string[] = [];
    const TrailingWidget = markRaw(
      defineComponent({
        setup: () => () => h("div", { "data-testid": "hybrid-tail" }, "尾部自定义栏"),
      }),
    );
    const hybridView = defineWorkbenchView({
      id: "hybrid",
      title: "混合侧栏",
      areas: {
        primarySidebar: {
          list: {
            ariaLabel: "主菜单",
            items: [{ id: "overview", title: "概览", selected: true }],
            onSelect: (item) => clicks.push(String(item.id)),
          },
          component: TrailingWidget,
        },
        mainArea: DummyMain,
      },
    });
    const wrapper = mount(WorkbenchRoot, {
      props: {
        view: hybridView,
        navItems,
        activeNavItemId: "hybrid",
        topbarMenus: [],
        statusbarItems: [],
      },
    });
    try {
      const aside = wrapper.get("aside");
      const container = aside.get('[aria-label="主菜单"]');
      const children = Array.from(container.element.children);
      expect(children).toHaveLength(2);
      expect(children[0]!.textContent).toContain("概览");
      expect(children[1]!.getAttribute("data-testid")).toBe("hybrid-tail");

      await container.get("button").trigger("click");
      expect(clicks).toEqual(["overview"]);
    } finally {
      wrapper.unmount();
    }
  });

  it("桌面端空 descriptor 不渲染空的 primarySidebar", () => {
    useViewport(false);
    const emptySidebarView = defineWorkbenchView({
      id: "empty-sidebar",
      title: "空侧栏",
      areas: {
        primarySidebar: { list: undefined, component: undefined } as never,
        mainArea: DummyMain,
      },
    });
    const wrapper = mount(WorkbenchRoot, {
      props: {
        view: emptySidebarView,
        navItems,
        activeNavItemId: "empty-sidebar",
        topbarMenus: [],
        statusbarItems: [],
      },
    });
    try {
      expect(wrapper.find("aside").exists()).toBe(false);
    } finally {
      wrapper.unmount();
    }
  });

  it("移动端内置列表侧边栏可渲染列表并在点击项后切入 mainArea", async () => {
    useViewport(true);
    const listOnlyView = defineWorkbenchView({
      id: "list-mobile",
      title: "列表工作台",
      areas: {
        primarySidebar: {
          list: {
            ariaLabel: "移动列表",
            items: [{ id: "first", title: "第一条目" }],
          },
        },
        mainArea: DummyMain,
      },
    });
    const wrapper = mount(WorkbenchRoot, {
      props: {
        view: listOnlyView,
        navItems,
        activeNavItemId: "list-mobile",
        topbarMenus: [],
        statusbarItems: [],
      },
    });
    try {
      const list = wrapper.get('[aria-label="移动列表"]');
      expect(list.text()).toContain("第一条目");
      await list.get("button").trigger("click");
      expect(wrapper.find('[data-testid="main-area"]').exists()).toBe(true);
    } finally {
      wrapper.unmount();
    }
  });

  it("混合模式空列表默认不显示空提示，且同 viewId 下动态更新 list 配置保持响应式", async () => {
    useViewport(false);
    const TrailingWidget = markRaw(
      defineComponent({
        setup: () => () => h("div", { "data-testid": "hybrid-tail" }, "尾部自定义栏"),
      }),
    );
    const viewWithList = (title: string, items: { id: string; title: string }[]) =>
      defineWorkbenchView({
        id: "same-view",
        title: "响应式侧栏",
        areas: {
          primarySidebar: {
            list: { ariaLabel: "动态列表", items },
            component: TrailingWidget,
          },
          mainArea: DummyMain,
        },
      });
    const wrapper = mount(WorkbenchRoot, {
      props: {
        view: viewWithList("initial", []),
        navItems,
        activeNavItemId: "same-view",
        topbarMenus: [],
        statusbarItems: [],
      },
    });
    try {
      const aside = wrapper.get("aside");
      expect(aside.text()).not.toContain("暂无数据");
      expect(aside.find('[data-testid="hybrid-tail"]').exists()).toBe(true);

      await wrapper.setProps({
        view: viewWithList("updated", [{ id: "n1", title: "新条目" }]),
      });
      expect(aside.text()).toContain("新条目");
    } finally {
      wrapper.unmount();
    }
  });
});
