<script setup lang="ts">
import { computed, KeepAlive, type Component } from "vue";
import { provideWorkbenchAreaId } from "./runtime/workbenchAreaContext.js";
import type { WorkbenchAreaId } from "./types.js";
const props = withDefaults(
  defineProps<{
    areaId: WorkbenchAreaId;
    component?: Component;
    viewId?: string;
    cache?: boolean;
    cacheMax?: number;
    visible?: boolean;
  }>(),
  { visible: true },
);
provideWorkbenchAreaId(computed(() => props.areaId));
</script>
<template>
  <KeepAlive :max="cacheMax ?? 8">
    <component
      :is="component"
      v-if="cache && component && visible !== false"
      :key="`${viewId}:${areaId}`"
    />
  </KeepAlive>
  <component :is="component" v-if="!cache && component && visible !== false" />
</template>
