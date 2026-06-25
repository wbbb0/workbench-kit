<script setup lang="ts">
import type { WorkbenchBreadcrumbItem } from "./breadcrumbTypes";

defineProps<{
  items: readonly WorkbenchBreadcrumbItem[];
}>();
</script>

<template>
  <nav v-if="items.length" class="flex shrink-0 items-center gap-1 text-small text-text-muted" aria-label="Breadcrumb">
    <template v-for="(item, index) in items" :key="`${item.label}-${index}`">
      <a
        v-if="item.href"
        :href="item.href"
        class="hover:text-text-secondary"
      >
        {{ item.label }}
      </a>
      <span v-else class="text-text-subtle">{{ item.label }}</span>
      <span class="text-text-subtle">/</span>
    </template>
  </nav>
</template>
