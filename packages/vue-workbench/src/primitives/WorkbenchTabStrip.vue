<script setup lang="ts">
import type { WorkbenchTabStripItem } from "./tabStripTypes";

withDefaults(defineProps<{
  items: readonly WorkbenchTabStripItem[];
  modelValue: string;
  size?: "sm" | "md";
  bordered?: boolean;
}>(), {
  size: "md",
  bordered: false
});

defineEmits<{
  "update:modelValue": [value: string];
}>();
</script>

<template>
  <div
    :class="[
      'scrollbar-thin flex min-w-0 max-w-full gap-1 overflow-x-auto',
      bordered ? 'border-b border-border-default' : '',
      size === 'sm' ? 'px-3' : ''
    ]"
  >
    <button
      v-for="item in items"
      :key="item.id"
      type="button"
      :title="item.title || item.label"
      :aria-pressed="modelValue === item.id"
      :disabled="item.disabled"
      :class="[
        'flex shrink-0 items-center gap-1 border-0 border-b-2 border-transparent bg-transparent text-small whitespace-nowrap text-text-muted transition-colors hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'h-9 px-2.5' : 'h-10 px-3',
        modelValue === item.id ? 'border-b-accent text-text-secondary' : ''
      ]"
      @click="$emit('update:modelValue', item.id)"
    >
      {{ item.label }}
    </button>
  </div>
</template>
