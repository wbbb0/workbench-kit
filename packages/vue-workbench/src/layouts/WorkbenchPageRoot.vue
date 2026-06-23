<script setup lang="ts">
import { computed, defineComponent } from "vue";
import WorkbenchRuntimeRoot from "../WorkbenchRuntimeRoot.vue";
import { defineWorkbenchView, type WorkbenchView } from "../types";

const RuntimeOnlyArea = defineComponent({
  name: "WorkbenchPageRootRuntimeOnlyArea",
  setup: () => () => null
});

const props = withDefaults(defineProps<{
  title?: string;
  subtitle?: string;
  view?: WorkbenchView;
  isMobile?: boolean;
  showHeader?: boolean;
  homeHref?: string;
  homeLabel?: string;
  contentClass?: string;
}>(), {
  title: "Workbench",
  subtitle: "",
  view: undefined,
  isMobile: false,
  showHeader: true,
  homeHref: "",
  homeLabel: "Home",
  contentClass: ""
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
</script>

<template>
  <WorkbenchRuntimeRoot :view="resolvedView" :is-mobile="isMobile">
    <div class="flex h-dvh min-h-0 flex-col overflow-hidden bg-surface-app text-text-primary">
      <header v-if="showHeader" class="shrink-0 border-b border-border-default bg-surface-sidebar">
        <div class="mx-auto flex w-full max-w-5xl flex-col gap-3 px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex min-w-0 items-baseline gap-3">
            <a
              v-if="homeHref"
              :href="homeHref"
              class="shrink-0 text-ui font-semibold text-text-secondary hover:text-text-primary"
            >
              {{ homeLabel }}
            </a>
            <h1 v-else class="truncate text-ui font-semibold text-text-secondary">
              {{ title }}
            </h1>
            <span v-if="subtitle" class="hidden truncate text-small text-text-subtle sm:inline">
              {{ subtitle }}
            </span>
          </div>

          <nav v-if="$slots.actions" class="flex flex-wrap gap-3 text-small text-text-muted">
            <slot name="actions" />
          </nav>
        </div>
      </header>

      <main class="scrollbar-thin min-h-0 flex-1 overflow-auto">
        <div class="mx-auto w-full max-w-5xl px-6 py-6" :class="contentClass">
          <slot />
        </div>
      </main>
    </div>
  </WorkbenchRuntimeRoot>
</template>
