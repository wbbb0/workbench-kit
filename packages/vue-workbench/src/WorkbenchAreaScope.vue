<script setup lang="ts">
import { KeepAlive, type Component } from "vue";
import WorkbenchAreaContent from "./WorkbenchAreaContent.vue";
import type { WorkbenchPageLocation } from "./runtime/pageNavigation.js";
import type { WorkbenchAreaId } from "./types.js";
withDefaults(
  defineProps<{
    areaId: WorkbenchAreaId;
    component?: Component;
    viewId?: string;
    cache?: boolean;
    cacheMax?: number;
    visible?: boolean;
    leavingPath?: readonly WorkbenchPageLocation[];
  }>(),
  { visible: true },
);
</script>
<template>
  <KeepAlive :max="cacheMax ?? 8">
    <WorkbenchAreaContent
      v-if="cache && component && visible"
      :key="`${viewId}:${areaId}`"
      :area-id="areaId"
      :component="component"
      :leaving-path="leavingPath"
    />
  </KeepAlive>
  <WorkbenchAreaContent
    v-if="!cache && component && visible"
    :key="`${viewId}:${areaId}`"
    :area-id="areaId"
    :component="component"
    :leaving-path="leavingPath"
  />
</template>
