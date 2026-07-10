<script setup lang="ts">
import { computed, defineComponent } from "vue";
import WorkbenchRuntimeRoot from "../WorkbenchRuntimeRoot.vue";
import WorkbenchBreadcrumbs from "../primitives/WorkbenchBreadcrumbs.vue";
import type { WorkbenchBreadcrumbItem } from "../primitives/breadcrumbTypes";
import { defineWorkbenchView, type WorkbenchView } from "../types";

const RuntimeOnlyArea = defineComponent({
  name: "WorkbenchPageRootRuntimeOnlyArea",
  setup: () => () => null
});

const props = withDefaults(defineProps<{
  title?: string;
  subtitle?: string;
  breadcrumbs?: WorkbenchBreadcrumbItem[];
  view?: WorkbenchView;
  showHeader?: boolean;
  homeHref?: string;
  homeLabel?: string;
  contentClass?: string;
  contentLayout?: "constrained" | "wide" | "full";
}>(), {
  title: "Workbench",
  subtitle: "",
  breadcrumbs: () => [],
  view: undefined,
  showHeader: true,
  homeHref: "",
  homeLabel: "Home",
  contentClass: "",
  contentLayout: "constrained"
});

const resolvedView = computed(() => props.view ?? defineWorkbenchView({
  id: "workbench-page-root",
  title: props.title,
  areas: {
    mainArea: RuntimeOnlyArea
  },
  layout: {
    mobile: {
      rootArea: "mainArea"
    }
  }
}));

const mainClass = computed(() => props.contentLayout === "full"
  ? "min-h-0 flex-1 overflow-hidden"
  : "scrollbar-thin min-h-0 flex-1 overflow-auto");

const headerShellClass = "mx-auto flex h-10 w-full max-w-5xl flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between";

const contentShellClass = computed(() => {
  if (props.contentLayout === "full") {
    return ["h-full min-h-0 w-full", props.contentClass];
  }
  if (props.contentLayout === "wide") {
    return ["mx-auto w-full max-w-7xl px-6 py-6", props.contentClass];
  }
  return ["mx-auto w-full max-w-5xl px-6 py-6", props.contentClass];
});
</script>

<template>
  <WorkbenchRuntimeRoot :view="resolvedView">
    <div class="flex h-dvh min-h-0 flex-col overflow-hidden bg-surface-app text-text-primary">
      <header v-if="showHeader" class="shrink-0 border-b border-border-default bg-surface-sidebar">
        <div :class="headerShellClass">
          <div class="flex min-w-0 items-baseline gap-3">
            <div class="flex min-w-0 items-baseline gap-1">
              <WorkbenchBreadcrumbs :items="breadcrumbs" />
              <a
                v-if="!breadcrumbs.length && homeHref"
                :href="homeHref"
                class="shrink-0 text-ui font-semibold text-text-secondary hover:text-text-primary"
              >
                {{ homeLabel }}
              </a>
              <h1 class="truncate text-ui font-semibold text-text-secondary">
                {{ title }}
              </h1>
            </div>
            <span v-if="subtitle" class="hidden truncate text-small text-text-subtle sm:inline">
              {{ subtitle }}
            </span>
          </div>

          <nav v-if="$slots.actions" class="flex flex-wrap gap-3 text-small text-text-muted">
            <slot name="actions" />
          </nav>
        </div>
      </header>

      <main :class="mainClass">
        <div :class="contentShellClass">
          <slot />
        </div>
      </main>
    </div>
  </WorkbenchRuntimeRoot>
</template>
