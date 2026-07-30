<script setup lang="ts">
import { computed, nextTick } from "vue";
import type { WorkbenchTabStripItem } from "./tabStripTypes";

const props = withDefaults(defineProps<{
  items: readonly WorkbenchTabStripItem[];
  modelValue: string;
  size?: "sm" | "md";
  bordered?: boolean;
}>(), {
  size: "md",
  bordered: false
});

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();
const selectedItemId = computed(() => (
  props.items.some((item) => item.id === props.modelValue && !item.disabled)
    ? props.modelValue
    : null
));
const rovingItemId = computed(() => selectedItemId.value ?? props.items.find((item) => !item.disabled)?.id ?? null);

function onTabKeydown(event: KeyboardEvent) {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
    return;
  }
  const current = event.currentTarget instanceof HTMLButtonElement ? event.currentTarget : null;
  const container = current?.parentElement;
  if (!current || !container) {
    return;
  }
  const tabs = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)'));
  const currentIndex = tabs.indexOf(current);
  if (currentIndex < 0 || !tabs.length) {
    return;
  }
  event.preventDefault();
  const nextIndex = event.key === "Home"
    ? 0
    : event.key === "End"
      ? tabs.length - 1
      : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
  const nextTab = tabs[nextIndex];
  const paneId = nextTab?.dataset.tabId;
  if (!nextTab || !paneId) {
    return;
  }
  emit("update:modelValue", paneId);
  void nextTick(() => nextTab.focus());
}
</script>

<template>
  <div
    :class="[
      'scrollbar-thin flex min-w-0 max-w-full gap-1 overflow-x-auto',
      bordered ? 'border-b border-border-default' : '',
      size === 'sm' ? 'px-3' : ''
    ]"
    role="tablist"
  >
    <button
      v-for="item in items"
      :key="item.id"
      :data-tab-id="item.id"
      :id="item.tabId"
      type="button"
      :title="item.title || item.label"
      role="tab"
      :aria-selected="selectedItemId === item.id"
      :aria-controls="item.controls"
      :tabindex="rovingItemId === item.id ? 0 : -1"
      :disabled="item.disabled"
      :class="[
        'flex shrink-0 items-center gap-1 border-0 border-b-2 border-transparent bg-transparent text-small whitespace-nowrap text-text-muted transition-colors hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'h-9 px-2.5' : 'h-10 px-3',
        selectedItemId === item.id ? 'border-b-accent text-text-secondary' : ''
      ]"
      @click="$emit('update:modelValue', item.id)"
      @keydown="onTabKeydown"
    >
      {{ item.label }}
    </button>
  </div>
</template>
