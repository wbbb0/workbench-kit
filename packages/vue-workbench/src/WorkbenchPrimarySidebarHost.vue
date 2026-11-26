<script setup lang="ts">
import { computed, unref, type Component } from "vue";
import WorkbenchSidebarListPane from "./primitives/WorkbenchSidebarListPane.vue";
import type {
  WorkbenchSidebarListConfig,
  WorkbenchSidebarListSource,
} from "./primitives/sidebarListTypes.js";

const props = defineProps<{
  list: WorkbenchSidebarListSource<any>;
  component?: Component;
}>();

const setupSource = typeof props.list === "function" ? props.list() : undefined;
const config = computed<WorkbenchSidebarListConfig<any>>(() => {
  if (typeof props.list === "function") {
    return unref(setupSource ?? props.list());
  }
  return unref(props.list);
});

const paneProps = computed(() => ({
  title: config.value.title,
  ariaLabel: config.value.ariaLabel,
  role: config.value.role,
  items: config.value.items,
  loading: config.value.loading,
  emptyMessage: config.value.emptyMessage ?? (props.component ? "" : undefined),
  showHeader: config.value.showHeader ?? false,
  divided: config.value.divided ?? true,
  dense: config.value.dense ?? false,
  multiline: config.value.multiline ?? false,
  navigate: config.value.navigate ?? true,
  itemKey: config.value.itemKey,
}));

function handleSelect(item: unknown, index: number) {
  config.value.onSelect?.(item, index);
}
</script>

<template>
  <WorkbenchSidebarListPane v-bind="paneProps" @select="handleSelect">
    <component :is="component" v-if="component" />
  </WorkbenchSidebarListPane>
</template>
