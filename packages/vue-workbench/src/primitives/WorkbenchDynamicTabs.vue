<script setup lang="ts">
import { ref } from "vue";
import { Plus, X } from "lucide-vue-next";
import type { WorkbenchDynamicTabItem } from "./dynamicTabsTypes";

const props = withDefaults(defineProps<{
  items: readonly WorkbenchDynamicTabItem[];
  modelValue: string;
  size?: "sm" | "md";
  addable?: boolean;
  addLabel?: string;
  bordered?: boolean;
  draggable?: boolean;
}>(), {
  size: "md",
  addable: false,
  addLabel: "Add",
  bordered: true,
  draggable: false
});

const emit = defineEmits<{
  "update:modelValue": [value: string];
  add: [];
  close: [value: string];
  context: [value: string, event: MouseEvent];
  reorder: [sourceId: string, targetId: string];
}>();

const draggingId = ref<string | null>(null);

function startDrag(item: WorkbenchDynamicTabItem, event: DragEvent): void {
  if (!props.draggable || item.disabled) {
    event.preventDefault();
    return;
  }
  draggingId.value = item.id;
  event.dataTransfer?.setData("text/plain", item.id);
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
  }
}

function dropOn(item: WorkbenchDynamicTabItem, event: DragEvent): void {
  if (!props.draggable || item.disabled) {
    return;
  }
  const sourceId = event.dataTransfer?.getData("text/plain") || draggingId.value;
  draggingId.value = null;
  if (!sourceId || sourceId === item.id) {
    return;
  }
  emit("reorder", sourceId, item.id);
}
</script>

<template>
  <div
    :class="[
      'flex min-w-0 max-w-full items-end gap-1 overflow-hidden',
      bordered ? 'border-b border-border-default' : ''
    ]"
  >
    <div class="scrollbar-thin flex min-w-0 flex-1 gap-1 overflow-x-auto">
      <button
        v-for="item in items"
        :key="item.id"
        class="group grid min-w-[120px] max-w-56 shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-1 rounded-t-md border border-border-subtle border-b-0 bg-surface-muted px-2 text-left text-small text-text-muted transition-colors hover:bg-surface-hover hover:text-text-secondary disabled:cursor-not-allowed disabled:opacity-50"
        :class="[
          size === 'sm' ? 'h-8' : 'h-9',
          modelValue === item.id ? 'border-border-default bg-surface-default text-text-secondary shadow-[0_-1px_0_var(--accent)_inset]' : ''
        ]"
        type="button"
        :title="item.title || item.label"
        :aria-pressed="modelValue === item.id"
        :disabled="item.disabled"
        :draggable="draggable && !item.disabled"
        @click="emit('update:modelValue', item.id)"
        @contextmenu.prevent="emit('context', item.id, $event)"
        @dragstart="startDrag(item, $event)"
        @dragover.prevent
        @drop.prevent="dropOn(item, $event)"
        @dragend="draggingId = null"
      >
        <span class="min-w-0 truncate">{{ item.label }}</span>
        <span v-if="item.meta !== undefined" class="rounded bg-surface-input px-1 font-mono text-[10px] text-text-subtle">{{ item.meta }}</span>
        <button
          v-if="item.closable"
          class="-mr-1 flex size-5 items-center justify-center rounded text-text-subtle opacity-70 hover:bg-surface-input hover:text-text-secondary group-hover:opacity-100"
          type="button"
          :title="`Close ${item.label}`"
          @click.stop="emit('close', item.id)"
        >
          <X class="size-3.5" aria-hidden="true" />
        </button>
      </button>
    </div>

    <button
      v-if="addable"
      class="sticky right-0 z-10 mb-px flex shrink-0 items-center justify-center rounded-md border border-border-subtle bg-surface-muted text-text-muted hover:bg-surface-hover hover:text-text-secondary"
      :class="size === 'sm' ? 'size-8' : 'size-9'"
      type="button"
      :title="addLabel"
      @click="emit('add')"
    >
      <Plus class="size-4" aria-hidden="true" />
    </button>
  </div>
</template>
