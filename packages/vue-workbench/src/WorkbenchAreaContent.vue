<script setup lang="ts">
import { computed, onActivated, onDeactivated, ref, type Component } from "vue";
import type { WorkbenchPageLocation } from "./runtime/pageNavigation.js";
import {
  provideWorkbenchAreaId,
  provideWorkbenchAreaPresentation,
} from "./runtime/workbenchAreaContext.js";
import type { WorkbenchAreaId } from "./types.js";

const props = defineProps<{
  areaId: WorkbenchAreaId;
  component: Component;
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
</script>

<template>
  <component :is="component" />
</template>
