<script setup lang="ts">
import {
  computed,
  onMounted,
  onUnmounted,
  provide,
  ref,
  watch,
  type Component,
} from "vue";
import { ArrowLeft } from "lucide-vue-next";
import { mobilePageColumns } from "./runtime/pageColumns";
import { usePageSurfaceMotion } from "./runtime/usePageMotion";
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

provide(
  mobilePageColumns,
  computed(() => true),
);

const stage = ref<HTMLElement | null>(null);
const rootSurface = ref<HTMLElement | null>(null);
const detailSurface = ref<HTMLElement | null>(null);
const width = ref(0);
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
const isMobileOverlayVisible = computed(
  () => props.runtime.activeMobileAreaId.value !== mobileRootAreaId.value,
);
const activeAreaPages = computed(() => {
  const view = props.view;
  const root = mobileRootAreaId.value;
  const active = props.runtime.activeMobileAreaId.value;
  const path = props.runtime.pages.path.value;
  const area = (areaId: typeof root) => ({
    key: JSON.stringify([view.id, path[0]?.key, areaId]),
    areaId,
    component: view.areas[areaId] as Component | undefined,
    path,
  });
  return active === root ? [area(root)] : [area(root), area(active)];
});
const { transition, cancel } = usePageSurfaceMotion(
  computed(() => ({
    pages: activeAreaPages.value,
    layoutKey: String(width.value),
    enabled: true,
  })),
  () => [rootSurface.value, detailSurface.value],
  (from, to) =>
    [from, to].some(
      (area) =>
        area.areaId !== mobileRootAreaId.value &&
        area.path.at(-1)?.presentation !== undefined,
    ),
);
const detail = computed(() =>
  isMobileOverlayVisible.value
    ? activeAreaPages.value.at(-1)
    : transition.value?.from,
);
const leavingPath = computed(() =>
  transition.value?.direction === "back"
    ? transition.value.from.path
    : undefined,
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

watch(stage, (element) => {
  props.runtime.mainRegionRef.value = element;
});
let observer: ResizeObserver | undefined;

onMounted(() => {
  const element = stage.value;
  if (element && typeof ResizeObserver !== "undefined") {
    width.value = element.clientWidth;
    observer = new ResizeObserver(([entry]) => {
      if (entry?.contentRect.width) width.value = entry.contentRect.width;
    });
    observer.observe(element);
  }
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
  cancel();
  observer?.disconnect();
  window.removeEventListener("popstate", handlePopState);
});
</script>

<template>
  <div
    class="fixed inset-0 flex h-full w-full flex-col overflow-hidden bg-surface-app text-text-primary"
  >
    <header
      class="pt-safe flex h-[calc(44px+env(safe-area-inset-top))] shrink-0 items-center gap-2 border-b border-border-default bg-surface-sidebar px-3"
    >
      <button
        v-if="canPopMobileArea"
        :aria-label="backLabel"
        :disabled="runtime.pages.pending.value"
        class="flex shrink-0 items-center gap-1 text-accent"
        @click="goBack"
      >
        <ArrowLeft :size="20" aria-hidden="true" />
        <span>返回</span>
      </button>
      <span class="min-w-0 flex-1 truncate font-semibold text-text-secondary">{{
        pageLabel
      }}</span>
      <nav v-if="!canPopMobileArea" class="flex gap-1">
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
    <div ref="stage" class="relative isolate min-h-0 flex-1 overflow-clip">
      <section
        ref="rootSurface"
        aria-label="一级页面"
        class="absolute inset-0 flex flex-col overflow-hidden bg-surface-app"
        :inert="isMobileOverlayVisible"
      >
        <WorkbenchAreaScope
          :area-id="mobileRootAreaId"
          :component="mobileRootArea"
          :view-id="view.id"
          :cache="!!view.cache?.areas?.includes(mobileRootAreaId)"
          :cache-max="view.cache?.max"
        />
      </section>
      <section
        v-show="!!detail"
        ref="detailSurface"
        aria-label="详情页面"
        class="absolute inset-0 z-10 flex flex-col overflow-hidden bg-surface-app"
        @click.self="!isMobileOverlayVisible && $event.stopPropagation()"
      >
        <div
          class="flex min-h-0 flex-1 flex-col overflow-hidden"
          :inert="!isMobileOverlayVisible"
        >
          <WorkbenchAreaScope
            :area-id="detail?.areaId ?? 'mainArea'"
            :component="detail?.component"
            :view-id="view.id"
            :visible="!!detail"
            :leaving-path="leavingPath"
            :cache="!!detail && !!view.cache?.areas?.includes(detail.areaId)"
            :cache-max="view.cache?.max"
          />
        </div>
      </section>
    </div>
  </div>
</template>
