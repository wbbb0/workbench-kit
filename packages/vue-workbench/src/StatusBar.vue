<script setup lang="ts">
import type { StyleValue } from "vue";
import type { WorkbenchStatusbarItem } from "./chrome";

const props = defineProps<{
  items: WorkbenchStatusbarItem[];
  statusbarClass?: string;
  statusbarStyle?: StyleValue;
}>();
</script>

<template>
  <footer
    class="pb-safe flex min-h-8 shrink-0 items-center gap-2 border-t border-border-default bg-surface-sidebar px-2 text-text-muted"
    :class="props.statusbarClass"
    :style="props.statusbarStyle"
  >
    <component
      :is="item.component"
      v-for="item in props.items"
      :key="item.id"
      v-bind="item.props"
    />
  </footer>
</template>
