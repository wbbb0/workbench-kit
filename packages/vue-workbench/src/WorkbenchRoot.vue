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
  /** Activity bar 导航项，导航行为通过 navigate 事件交给业务项目处理。 */
  navItems: readonly WorkbenchNavItem[];
  /** 当前高亮导航项 ID。 */
  activeNavItemId: string;
  /** 顶部菜单定义。 */
  topbarMenus: WorkbenchTopbarMenu[];
  /** 状态栏组件项。 */
  statusbarItems: WorkbenchStatusbarItem[];
  /** 是否使用移动端布局。媒体查询或 store 由业务项目维护。 */
  isMobile: boolean;
};

const props = defineProps<WorkbenchRootProps>();

const emit = defineEmits<{
  navigate: [itemId: string];
}>();
</script>

<template>
  <WorkbenchRuntimeRoot :view="view" :is-mobile="isMobile">
    <template #default="{ runtime }">
      <WorkbenchShell
        :runtime="runtime"
        :view="view"
        :nav-items="navItems"
        :active-nav-item-id="activeNavItemId"
        :topbar-menus="topbarMenus"
        :statusbar-items="statusbarItems"
        :is-mobile="isMobile"
        @navigate="emit('navigate', $event)"
      />
    </template>
  </WorkbenchRuntimeRoot>
</template>
