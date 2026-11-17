<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { usePageMotion } from "./runtime/usePageMotion";
import WorkbenchAreaScope from "./WorkbenchAreaScope.vue";
import {
  createStatusbarMenuNodes,
  type WorkbenchStatusbarItem,
  type WorkbenchTopbarMenu,
} from "./chrome";
import { groupWorkbenchNavItems, type WorkbenchNavItem } from "./navigation";
import { useMenuTrigger } from "./menu/useMenuTrigger";
import type { WorkbenchRuntime } from "./runtime/workbenchRuntime";
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

const rootSurface = ref<HTMLElement | null>(null);
const overlaySurface = ref<HTMLElement | null>(null);
usePageMotion(
  computed(() => ({
    viewId: props.view.id,
    keys: props.runtime.pages.controlled.value
      ? props.runtime.pages.path.value.map((page) => page.key)
      : [],
  })),
  () =>
    isMobileOverlayVisible.value ? overlaySurface.value : rootSurface.value,
);
const mainArea = computed(() => props.view.areas.mainArea);
const pageLabel = computed(
  () => props.runtime.pages.current.value?.title ?? routeLabel.value,
);
const backLabel = computed(() =>
  props.runtime.pages.parent.value
    ? `返回${props.runtime.pages.parent.value.title}`
    : "返回",
);
const routeLabel = computed(
  () =>
    props.view.title ||
    props.navItems.find((item) => item.id === props.activeNavItemId)?.title ||
    "",
);
const mobileNavItems = computed(() => {
  const groups = groupWorkbenchNavItems(props.navItems);
  return [...groups.primary, ...groups.bottom];
});
const mobileRootAreaId = computed(() => props.runtime.mobileRootAreaId.value);
const mobileRootArea = computed(() => props.view.areas[mobileRootAreaId.value]);
const activeMobileArea = computed(
  () =>
    props.view.areas[props.runtime.activeMobileAreaId.value] ?? mainArea.value,
);
const hasMobileRootArea = computed(
  () => mobileRootAreaId.value !== "mainArea" && !!mobileRootArea.value,
);
const isActiveMobileAreaVisible = computed(
  () =>
    mobileRootAreaId.value === "mainArea" ||
    props.runtime.activeMobileAreaId.value !== mobileRootAreaId.value,
);
const isMobileOverlayVisible = computed(
  () => props.runtime.activeMobileAreaId.value !== mobileRootAreaId.value,
);
const canPopMobileArea = computed(() => props.runtime.canPopMobileArea.value);
const mobileHistoryDepth = ref(0);
const mobileHistoryStateKey = "__workbenchMobileArea";

const mobileWorkbenchTrigger = useMenuTrigger({
  baseId: "mobile-workbench-menu",
  source: "mobile-workbench",
  resolveItems: () => [
    ...props.topbarMenus.map((menu) => ({
      kind: "submenu" as const,
      id: `mobile-${menu.id}`,
      label: menu.label,
      children: menu.resolveItems(),
    })),
    {
      kind: "submenu",
      id: "mobile-statusbar",
      label: "状态栏",
      children: createStatusbarMenuNodes(props.statusbarItems),
    },
  ],
});

watch(
  () => [props.view.id, props.view.layout.mobile.rootArea] as const,
  () => {
    props.runtime.resetMobileAreaStack();
    mobileHistoryDepth.value = 0;
  },
  { immediate: true },
);

function pushMobileHistoryEntry() {
  if (props.runtime.pages.controlled.value) return;
  if (typeof window === "undefined") {
    return;
  }

  const currentState =
    typeof window.history.state === "object" && window.history.state !== null
      ? window.history.state
      : {};
  window.history.pushState(
    {
      ...currentState,
      [mobileHistoryStateKey]: {
        viewId: props.view.id,
        areaId: props.runtime.activeMobileAreaId.value,
      },
    },
    "",
    window.location.href,
  );
  mobileHistoryDepth.value += 1;
}

function handlePopState() {
  if (props.runtime.pages.controlled.value) return;
  if (!props.runtime.canPopMobileArea.value) {
    return;
  }
  mobileHistoryDepth.value = Math.max(0, mobileHistoryDepth.value - 1);
  props.runtime.popMobileArea();
}

watch(
  () => props.runtime.mobileAreaStack.value.length,
  (stackLength) => {
    if (props.runtime.pages.controlled.value) return;
    const desiredDepth = Math.max(0, stackLength - 1);
    if (!isMobileOverlayVisible.value) {
      mobileHistoryDepth.value = 0;
      return;
    }
    while (mobileHistoryDepth.value < desiredDepth) {
      pushMobileHistoryEntry();
    }
  },
);

function goBack() {
  if (props.runtime.pages.controlled.value) {
    void props.runtime.pages.back();
    return;
  }
  if (mobileHistoryDepth.value > 0 && typeof window !== "undefined") {
    window.history.back();
    return;
  }
  if (canPopMobileArea.value) {
    props.runtime.popMobileArea();
  } else {
    props.runtime.showRootArea();
  }
}

function setRootSurface(element: unknown) {
  rootSurface.value = element instanceof HTMLElement ? element : null;
  if (!hasMobileRootArea.value) setMainRegionRef(element);
}
function setOverlaySurface(element: unknown) {
  overlaySurface.value = element instanceof HTMLElement ? element : null;
  setMainRegionRef(element);
}
function setMainRegionRef(element: unknown) {
  props.runtime.mainRegionRef.value =
    element instanceof HTMLElement ? element : null;
}

onMounted(() => {
  watch(
    () => props.runtime.pages.controlled.value,
    (controlled) => {
      window.removeEventListener("popstate", handlePopState);
      if (!controlled) window.addEventListener("popstate", handlePopState);
    },
    { immediate: true },
  );
});

onUnmounted(() => {
  window.removeEventListener("popstate", handlePopState);
});
</script>

<template>
  <div
    class="fixed inset-0 flex h-full w-full overflow-hidden bg-surface-app text-text-primary"
  >
    <div
      :ref="setRootSurface"
      :inert="isMobileOverlayVisible"
      class="absolute inset-0 flex flex-col bg-surface-app"
    >
      <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
        <header
          class="pt-safe flex h-[calc(44px+env(safe-area-inset-top))] shrink-0 items-center gap-2 border-b border-border-default bg-surface-sidebar px-3"
        >
          <button
            v-if="!isMobileOverlayVisible && canPopMobileArea"
            :aria-label="backLabel"
            :disabled="runtime.pages.pending.value"
            class="shrink-0 text-accent"
            @click="goBack"
          >
            ‹ 返回
          </button>
          <span
            class="min-w-0 flex-1 truncate font-semibold text-text-secondary"
            >{{ isMobileOverlayVisible ? routeLabel : pageLabel }}</span
          >
          <nav class="flex gap-1">
            <button
              v-for="item in mobileNavItems"
              :key="item.id"
              type="button"
              class="flex h-10 w-10 items-center justify-center rounded border-0 bg-transparent text-text-muted"
              :class="{ 'text-text-secondary': activeNavItemId === item.id }"
              @click="emit('navigate', item.id)"
            >
              <component :is="item.icon" :size="20" :stroke-width="1.5" />
              <span class="sr-only">{{ item.title }}</span>
            </button>
            <button
              class="flex h-10 w-10 items-center justify-center rounded border-0 bg-transparent text-text-muted"
              type="button"
              data-menu-trigger="mobile-workbench"
              @click="mobileWorkbenchTrigger.onClick"
              @contextmenu="mobileWorkbenchTrigger.onContextMenu"
              @pointerdown="mobileWorkbenchTrigger.onPointerDown"
              @pointerup="mobileWorkbenchTrigger.onPointerUp"
              @pointercancel="mobileWorkbenchTrigger.onPointerCancel"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
              >
                <circle cx="5" cy="12" r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="19" cy="12" r="1.5" />
              </svg>
              <span class="sr-only">工作台菜单</span>
            </button>
          </nav>
        </header>
        <WorkbenchAreaScope
          :area-id="mobileRootAreaId"
          :component="mobileRootArea"
          :view-id="view.id"
          :cache="!!view.cache?.areas?.includes(mobileRootAreaId)"
          :cache-max="view.cache?.max"
        />
      </div>
    </div>
    <div
      v-if="hasMobileRootArea"
      :ref="setOverlaySurface"
      :inert="!isActiveMobileAreaVisible"
      class="absolute inset-0 z-10 flex flex-col bg-surface-app"
      :class="[
        isActiveMobileAreaVisible
          ? 'translate-x-0'
          : 'pointer-events-none translate-x-full',
        !runtime.pages.controlled.value &&
          'motion-safe:transition-transform motion-safe:duration-220 motion-safe:ease-[ease]',
      ]"
    >
      <header
        class="pt-safe flex h-[calc(44px+env(safe-area-inset-top))] shrink-0 items-center gap-2 border-b border-border-default bg-surface-sidebar px-3"
      >
        <button
          v-if="canPopMobileArea"
          :aria-label="backLabel"
          :disabled="runtime.pages.pending.value"
          class="flex cursor-pointer items-center gap-1 border-0 bg-transparent px-0 py-1 text-ui text-accent"
          @click="goBack"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span>返回</span>
        </button>
        <span
          class="min-w-0 flex-1 truncate text-ui font-medium text-text-secondary"
          >{{ pageLabel }}</span
        >
      </header>
      <div class="min-h-0 flex-1 overflow-hidden">
        <WorkbenchAreaScope
          :area-id="runtime.activeMobileAreaId.value"
          :component="activeMobileArea"
          :view-id="view.id"
          :cache="
            !!view.cache?.areas?.includes(runtime.activeMobileAreaId.value)
          "
          :cache-max="view.cache?.max"
          :visible="isActiveMobileAreaVisible"
        />
      </div>
    </div>
  </div>
</template>
