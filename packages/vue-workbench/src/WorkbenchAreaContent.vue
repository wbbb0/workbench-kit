<script setup lang="ts">
import { computed, onActivated, onDeactivated, ref, type Component } from "vue";
import WorkbenchPrimarySidebarHost from "./WorkbenchPrimarySidebarHost.vue";
import {
  resolveWorkbenchPrimarySidebar,
  resolveWorkbenchSidebarListKey,
} from "./sidebarArea.js";
import type { WorkbenchPageLocation } from "./runtime/pageNavigation.js";
import {
  provideWorkbenchAreaId,
  provideWorkbenchAreaPresentation,
} from "./runtime/workbenchAreaContext.js";
import type { WorkbenchAreaContentTarget, WorkbenchAreaId } from "./types.js";

const props = defineProps<{
  areaId: WorkbenchAreaId;
  component: WorkbenchAreaContentTarget;
  leavingPath?: readonly WorkbenchPageLocation[];
}>();
const mounted = ref(true);
onActivated(() => {
  mounted.value = true;
});
onDeactivated(() => {
  mounted.value = false;
});
provideWorkbenchAreaId(computed(() => props.areaId));
provideWorkbenchAreaPresentation({
  active: computed(() => mounted.value && !props.leavingPath),
  leavingPath: computed(() => (mounted.value ? props.leavingPath : undefined)),
});
const resolved = computed(() =>
  props.areaId === "primarySidebar"
    ? resolveWorkbenchPrimarySidebar(props.component)
    : { kind: "component" as const, component: props.component as Component },
);
</script>

<template>
  <WorkbenchPrimarySidebarHost
    v-if="resolved.kind === 'list'"
    :key="resolveWorkbenchSidebarListKey(resolved.list)"
    :list="resolved.list"
    :component="resolved.component"
  />
  <component
    :is="resolved.component"
    v-else-if="resolved.kind === 'component'"
  />
</template>
