<script setup lang="ts">
import type { Component } from "vue";
import { ChevronRight, ExternalLink } from "lucide-vue-next";
defineProps<{
  label: string;
  expanded: boolean;
  detailLabel?: string;
  icon?: Component;
  state?: string;
  danger?: boolean;
}>();
const emit = defineEmits<{ toggle: []; detail: [] }>();
</script>
<template>
  <header
    class="flex min-w-0 items-center gap-2 bg-surface-muted/40 px-3 py-1 text-xs text-text-muted"
    :class="expanded ? 'border-b border-border-default' : ''"
  >
    <button
      type="button"
      class="flex min-w-0 flex-1 items-center gap-2 text-left"
      :title="label"
      :aria-label="(expanded ? '收起：' : '展开：') + label"
      :aria-expanded="expanded"
      @click="emit('toggle')"
    >
      <ChevronRight
        :size="12"
        class="shrink-0"
        :class="expanded ? 'rotate-90' : ''"
        aria-hidden="true"
      />
      <component
        v-if="icon"
        :is="icon"
        :size="15"
        class="shrink-0"
        aria-hidden="true"
      />
      <span class="truncate leading-6 font-medium">{{ label }}</span>
    </button>
    <span v-if="state" class="shrink-0" :class="danger ? 'text-danger' : ''">{{
      state
    }}</span>
    <button
      type="button"
      class="flex size-6 shrink-0 items-center justify-center"
      :aria-label="detailLabel ?? ('查看详情：' + label)"
      title="查看完整详情"
      @click="emit('detail')"
    >
      <ExternalLink :size="13" aria-hidden="true" />
    </button>
  </header>
</template>
