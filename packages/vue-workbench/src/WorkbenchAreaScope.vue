<script setup lang="ts">
import { computed, type Component } from "vue";
import { provideWorkbenchAreaId } from "./runtime/workbenchAreaContext.js";
import type { WorkbenchAreaId } from "./types.js";

const props = defineProps<{
  areaId: WorkbenchAreaId;
  component?: Component;
}>();

provideWorkbenchAreaId(computed(() => props.areaId));
</script>

<template>
  <component :is="component" v-if="component" />
</template>
