import { computed, h, ref } from "vue";
import { mount } from "@vue/test-utils";
import { expect, it, vi } from "vitest";
import WorkbenchActivityBar from "./WorkbenchActivityBar.vue";
import MobileWorkbench from "./MobileWorkbench.vue";
import WorkbenchRuntimeRoot from "./WorkbenchRuntimeRoot.vue";
import { defineWorkbenchView } from "./types";
import type { WorkbenchNavItem } from "./navigation";
import { createWorkbenchRuntime } from "./runtime/workbenchRuntime";

it("移动与桌面共享位置语义，交错输入仍保留组内顺序和点击目标", async () => {
  const icon = { render: () => h("svg") };
  const input = Object.freeze([
    { id: "aux-a", title: "辅助甲", placement: "bottom", icon },
    { id: "main-a", title: "主页甲", placement: "primary", icon },
    { id: "aux-b", title: "辅助乙", placement: "bottom", icon },
    { id: "main-b", title: "主页乙", placement: "primary", icon },
  ] as const satisfies readonly WorkbenchNavItem[]);
  const items = ref<readonly WorkbenchNavItem[]>(input);
  const view = defineWorkbenchView({
    id: "test",
    title: "测试",
    areas: { mainArea: { render: () => h("div") } },
  });
  const runtime = createWorkbenchRuntime(computed(() => view));
  const navigate = vi.fn();
  const desktop = mount(WorkbenchActivityBar, {
    props: { navItems: input, activeNavItemId: "aux-a" },
  });
  const mobile = mount(WorkbenchRuntimeRoot, {
    props: { view },
    slots: {
      default: () =>
        h(MobileWorkbench, {
          runtime,
          view,
          navItems: items.value,
          activeNavItemId: "aux-a",
          topbarMenus: [],
          statusbarItems: [],
          onNavigate: navigate,
        }),
    },
  });
  const labels = (wrapper: typeof desktop | typeof mobile) =>
    wrapper
      .findAll("nav button")
      .map((button) => button.text())
      .filter((label) => label !== "工作台菜单");
  try {
    const expected = ["主页甲", "主页乙", "辅助甲", "辅助乙"];
    expect(labels(desktop)).toEqual(expected);
    expect(labels(mobile)).toEqual(expected);
    await mobile
      .findAll("nav button")
      .find((button) => button.text() === "辅助甲")!
      .trigger("click");
    expect(navigate).toHaveBeenCalledWith("aux-a");
    const changed = input.map((item) =>
      item.id === "aux-a" ? { ...item, placement: "primary" as const } : item,
    );
    items.value = changed;
    await desktop.setProps({ navItems: changed });
    expect(labels(desktop)).toEqual(["辅助甲", "主页甲", "主页乙", "辅助乙"]);
    expect(labels(mobile)).toEqual(labels(desktop));
    expect(input.map((item) => item.id)).toEqual([
      "aux-a",
      "main-a",
      "aux-b",
      "main-b",
    ]);
  } finally {
    desktop.unmount();
    mobile.unmount();
  }
});
