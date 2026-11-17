import type { Component } from "vue";

/** Activity bar 中的一项导航入口。路由行为由业务项目处理。 */
export type WorkbenchNavItem = {
  /** 稳定 ID，通常与业务路由 name 或 section id 对齐。 */
  id: string;
  /** 鼠标悬浮和辅助技术使用的标题。 */
  title: string;
  /** lucide-vue-next 或业务自定义图标组件。 */
  icon: Component;
  /** 桌面按 primary/bottom 分区；移动按 primary → bottom 排列，组内保留输入顺序。 */
  placement: "primary" | "bottom";
};

/** 两种布局共用位置语义，不修改消费方传入的导航数组。 */
export function groupWorkbenchNavItems(items: readonly WorkbenchNavItem[]) {
  return {
    primary: items.filter((item) => item.placement === "primary"),
    bottom: items.filter((item) => item.placement === "bottom"),
  };
}
