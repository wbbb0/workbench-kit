<script setup lang="ts">
import { computed } from "vue";
import WorkbenchActivityBar from "./WorkbenchActivityBar.vue";
import WorkbenchAreaScope from "./WorkbenchAreaScope.vue";
import TopBar from "./TopBar.vue";
import StatusBar from "./StatusBar.vue";
import { usePointerDrag } from "./composables/usePointerDrag";
import WorkbenchSash from "./primitives/WorkbenchSash.vue";
import {
  getWorkbenchDesktopAreaSizeRange,
  type DesktopAreaId,
  type WorkbenchRuntime
} from "./runtime/workbenchRuntime";
import type { WorkbenchStatusbarItem, WorkbenchTopbarMenu } from "./chrome";
import type { WorkbenchNavItem } from "./navigation";
import type { WorkbenchView } from "./types";

const props = defineProps<{
  runtime: WorkbenchRuntime;
  view: WorkbenchView;
  navItems: readonly WorkbenchNavItem[];
  activeNavItemId: string;
  topbarMenus: WorkbenchTopbarMenu[];
  statusbarItems: WorkbenchStatusbarItem[];
}>();

const emit = defineEmits<{
  navigate: [itemId: string];
}>();

const primarySidebar = computed(() => props.view.areas.primarySidebar);
const mainArea = computed(() => props.view.areas.mainArea);
const secondarySidebar = computed(() => props.view.areas.secondarySidebar);
const bottomPanel = computed(() => props.view.areas.bottomPanel);
const hasPrimarySidebar = computed(() => !!primarySidebar.value);
const hasSecondarySidebar = computed(() => !!secondarySidebar.value);
const hasBottomPanel = computed(() => !!bottomPanel.value);
const primarySidebarStyle = computed(() => props.runtime.getDesktopAreaStyle("primarySidebar"));
const primarySidebarSize = computed(() => props.runtime.getDesktopAreaSizePx("primarySidebar"));
const secondarySidebarStyle = computed(() => props.runtime.getDesktopAreaStyle("secondarySidebar"));
const secondarySidebarSize = computed(() => props.runtime.getDesktopAreaSizePx("secondarySidebar"));
const bottomPanelStyle = computed(() => props.runtime.getDesktopAreaStyle("bottomPanel"));
const bottomPanelSize = computed(() => props.runtime.getDesktopAreaSizePx("bottomPanel"));
const primarySidebarRange = computed(() => getDesktopAreaSizeRange("primarySidebar"));
const secondarySidebarRange = computed(() => getDesktopAreaSizeRange("secondarySidebar"));
const bottomPanelRange = computed(() => getDesktopAreaSizeRange("bottomPanel"));

type ResizeAxis = "x" | "y";
type ActiveResize = {
  areaId: DesktopAreaId;
  axis: ResizeAxis;
  direction: 1 | -1;
  startSize: number;
};

function getDesktopAreaSizeRange(areaId: DesktopAreaId) {
  return getWorkbenchDesktopAreaSizeRange(props.runtime, areaId);
}

const desktopAreaResize = usePointerDrag<ActiveResize>({
  cursor: (state) => state.axis === "x" ? "col-resize" : "row-resize",
  onMove({ state, deltaX, deltaY }) {
    const delta = state.axis === "x" ? deltaX : deltaY;
    props.runtime.setDesktopAreaSize(
      state.areaId,
      state.startSize + delta * state.direction
    );
  }
});
const activeDesktopAreaId = computed(() => desktopAreaResize.activeState.value?.areaId ?? null);

function startDesktopAreaResize(areaId: DesktopAreaId, axis: ResizeAxis, direction: 1 | -1, event: PointerEvent) {
  desktopAreaResize.start(event, {
    areaId,
    axis,
    direction,
    startSize: props.runtime.getDesktopAreaSizePx(areaId)
  });
}

function resizeDesktopAreaBy(areaId: DesktopAreaId, deltaPx: number) {
  props.runtime.setDesktopAreaSize(areaId, props.runtime.getDesktopAreaSizePx(areaId) + deltaPx);
}

function onVerticalResizeKeydown(areaId: DesktopAreaId, direction: 1 | -1, event: KeyboardEvent) {
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    resizeDesktopAreaBy(areaId, (event.key === "ArrowRight" ? 16 : -16) * direction);
  }
}

function onHorizontalResizeKeydown(event: KeyboardEvent) {
  if (event.key === "ArrowUp") {
    event.preventDefault();
    resizeDesktopAreaBy("bottomPanel", 16);
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    resizeDesktopAreaBy("bottomPanel", -16);
  }
}

function resetDesktopAreaResize(areaId: DesktopAreaId) {
  props.runtime.resetDesktopAreaSize(areaId);
}

</script>

<template>
  <div class="relative flex h-full w-full overflow-hidden bg-surface-app text-text-primary">
    <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
      <TopBar :menus="topbarMenus" />
      <div class="flex min-h-0 flex-1 overflow-hidden">
        <WorkbenchActivityBar
          :nav-items="navItems"
          :active-nav-item-id="activeNavItemId"
          @navigate="emit('navigate', $event)"
        />
        <div
          v-if="hasPrimarySidebar"
          class="relative shrink-0 bg-surface-sidebar"
          :style="primarySidebarStyle"
        >
          <aside class="scrollbar-thin h-full overflow-x-hidden overflow-y-auto">
            <WorkbenchAreaScope area-id="primarySidebar" :component="primarySidebar" />
          </aside>
          <WorkbenchSash
            orientation="vertical"
            :active="activeDesktopAreaId === 'primarySidebar'"
            :style="{ left: '100%' }"
            label="Resize primary sidebar"
            :value-now="primarySidebarSize"
            :value-min="primarySidebarRange.min"
            :value-max="primarySidebarRange.max"
            :value-text="`${primarySidebarSize} pixels`"
            @pointerdown="startDesktopAreaResize('primarySidebar', 'x', 1, $event)"
            @dblclick="resetDesktopAreaResize('primarySidebar')"
            @keydown="onVerticalResizeKeydown('primarySidebar', 1, $event)"
          />
        </div>
        <section class="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          <main ref="runtime.mainRegionRef" class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden pr-safe">
            <WorkbenchAreaScope area-id="mainArea" :component="mainArea" />
          </main>
          <WorkbenchSash
            v-if="hasBottomPanel"
            orientation="horizontal"
            :active="activeDesktopAreaId === 'bottomPanel'"
            :style="{ top: `calc(100% - ${bottomPanelSize}px)` }"
            label="Resize bottom panel"
            :value-now="bottomPanelSize"
            :value-min="bottomPanelRange.min"
            :value-max="bottomPanelRange.max"
            :value-text="`${bottomPanelSize} pixels`"
            @pointerdown="startDesktopAreaResize('bottomPanel', 'y', -1, $event)"
            @dblclick="resetDesktopAreaResize('bottomPanel')"
            @keydown="onHorizontalResizeKeydown"
          />
          <aside
            v-if="hasBottomPanel"
            class="scrollbar-thin shrink-0 overflow-auto bg-surface-panel"
            :style="bottomPanelStyle"
          >
            <WorkbenchAreaScope area-id="bottomPanel" :component="bottomPanel" />
          </aside>
        </section>
        <div
          v-if="hasSecondarySidebar"
          class="relative shrink-0 bg-surface-sidebar"
          :style="secondarySidebarStyle"
        >
          <WorkbenchSash
            orientation="vertical"
            :active="activeDesktopAreaId === 'secondarySidebar'"
            :style="{ left: '0px' }"
            label="Resize secondary sidebar"
            :value-now="secondarySidebarSize"
            :value-min="secondarySidebarRange.min"
            :value-max="secondarySidebarRange.max"
            :value-text="`${secondarySidebarSize} pixels`"
            @pointerdown="startDesktopAreaResize('secondarySidebar', 'x', -1, $event)"
            @dblclick="resetDesktopAreaResize('secondarySidebar')"
            @keydown="onVerticalResizeKeydown('secondarySidebar', -1, $event)"
          />
          <aside class="scrollbar-thin h-full overflow-x-hidden overflow-y-auto">
            <WorkbenchAreaScope area-id="secondarySidebar" :component="secondarySidebar" />
          </aside>
        </div>
      </div>
      <StatusBar :items="statusbarItems" />
    </div>
  </div>
</template>
