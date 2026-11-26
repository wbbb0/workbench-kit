<script setup lang="ts">
import WorkbenchRuntimeRoot from "./WorkbenchRuntimeRoot.vue";
import WorkbenchShell from "./WorkbenchShell.vue";
import type { WorkbenchStatusbarItem, WorkbenchTopbarMenu } from "./chrome";
import type { WorkbenchNavItem } from "./navigation";
import type { WorkbenchView } from "./types";

/** WorkbenchRoot 的 public props。业务项目通常只需要挂载这一层组件。 */
type WorkbenchRootProps = {
  /** 当前激活的业务 view。 */
  view: WorkbenchView;
  pageNavigation?: import("./runtime/pageNavigation").WorkbenchPageNavigation;
  /** Activity bar 导航项，导航行为通过 navigate 事件交给业务项目处理。 */
  navItems: readonly WorkbenchNavItem[];
  /** 当前高亮导航项 ID。 */
  activeNavItemId: string;
  /** 顶部菜单定义。 */
  topbarMenus: WorkbenchTopbarMenu[];
  /** 顶部菜单为空时隐藏顶栏（仅桌面端生效）。默认启用。 */
  hideEmptyTopbar?: boolean;
  /** 状态栏组件项。 */
  statusbarItems: WorkbenchStatusbarItem[];
};

const props = withDefaults(defineProps<WorkbenchRootProps>(), {
  hideEmptyTopbar: true,
});

const emit = defineEmits<{
  navigate: [itemId: string];
}>();
</script>

<template>
  <WorkbenchRuntimeRoot :view="view" :page-navigation="pageNavigation">
    <template #default="{ runtime }">
      <WorkbenchShell
        :runtime="runtime"
        :view="view"
        :nav-items="navItems"
        :active-nav-item-id="activeNavItemId"
        :topbar-menus="topbarMenus"
        :hide-empty-topbar="props.hideEmptyTopbar"
        :statusbar-items="statusbarItems"
        @navigate="emit('navigate', $event)"
      />
    </template>
  </WorkbenchRuntimeRoot>
</template>
