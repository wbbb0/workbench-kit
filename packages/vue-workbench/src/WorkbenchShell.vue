<script setup lang="ts">
import DesktopWorkbench from "./DesktopWorkbench.vue";
import MobileWorkbench from "./MobileWorkbench.vue";
import type { WorkbenchStatusbarItem, WorkbenchTopbarMenu } from "./chrome";
import type { WorkbenchNavItem } from "./navigation";
import type { WorkbenchRuntime } from "./runtime/workbenchRuntime";
import { useWorkbenchViewport } from "./runtime/workbenchViewport";
import type { WorkbenchView } from "./types";

const props = withDefaults(
  defineProps<{
    runtime: WorkbenchRuntime;
    view: WorkbenchView;
    navItems: readonly WorkbenchNavItem[];
    activeNavItemId: string;
    topbarMenus: WorkbenchTopbarMenu[];
    hideEmptyTopbar?: boolean;
    statusbarItems: WorkbenchStatusbarItem[];
  }>(),
  {
    hideEmptyTopbar: true,
  },
);

const { isMobile } = useWorkbenchViewport();

const emit = defineEmits<{
  navigate: [itemId: string];
}>();
</script>

<template>
  <DesktopWorkbench
    v-if="!isMobile"
    :runtime="props.runtime"
    :view="view"
    :nav-items="navItems"
    :active-nav-item-id="activeNavItemId"
    :topbar-menus="topbarMenus"
    :hide-empty-topbar="props.hideEmptyTopbar"
    :statusbar-items="statusbarItems"
    @navigate="emit('navigate', $event)"
  />
  <MobileWorkbench
    v-else
    :runtime="props.runtime"
    :view="view"
    :nav-items="navItems"
    :active-nav-item-id="activeNavItemId"
    :topbar-menus="topbarMenus"
    :statusbar-items="statusbarItems"
    @navigate="emit('navigate', $event)"
  />
</template>
