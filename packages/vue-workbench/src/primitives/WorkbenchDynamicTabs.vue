<script setup lang="ts">
import { computed, ref, useId } from "vue";
import { ChevronDown, Plus, X } from "lucide-vue-next";
import { useWorkbenchControllerContext } from "../runtime/workbenchController.js";
import { useMenuRuntime } from "../menu/useMenuRuntime.js";
import type { MenuNode } from "../menu/types.js";
import type { WorkbenchDynamicTabItem } from "./dynamicTabsTypes";

const props = withDefaults(defineProps<{
  items: readonly WorkbenchDynamicTabItem[];
  modelValue: string;
  size?: "sm" | "md";
  addable?: boolean;
  addLabel?: string;
  bordered?: boolean;
  draggable?: boolean;
  /** 小于 480px 的容器宽度时显示当前标签与完整标签菜单。 */
  compact?: boolean;
  tabsLabel?: string;
}>(), {
  size: "md",
  addable: false,
  addLabel: "Add",
  bordered: true,
  draggable: false,
  compact: false,
  tabsLabel: "标签"
});

const emit = defineEmits<{
  "update:modelValue": [value: string];
  add: [];
  close: [value: string];
  context: [value: string, event: MouseEvent];
  reorder: [sourceId: string, targetId: string];
}>();

const controller = useWorkbenchControllerContext();
const menuId = useId();
const activeItem = computed(() => props.items.find(item => item.id === props.modelValue));
function selectTab(id: string) {
  const item = props.items.find(item => item.id === id);
  if (item && !item.disabled) emit("update:modelValue", id);
}
function closeTab(id: string) {
  const item = props.items.find(item => item.id === id);
  if (item?.closable && !item.disabled) emit("close", id);
}
function openTabs(event: MouseEvent) {
  const items: MenuNode[] = props.items.map(item => ({ kind: "action", id: item.id, label: `${item.id === props.modelValue ? "✓ " : ""}${item.label}`, disabled: item.disabled, onSelect: () => selectTab(item.id) }));
  const closable = props.items.filter(item => item.closable);
  if (closable.length) items.push({ kind: "submenu", id: "close-tabs", label: "关闭标签", children: closable.map(item => ({ kind: "action", id: `close-${item.id}`, label: item.label, disabled: item.disabled, onSelect: () => closeTab(item.id) })) });
  if (props.addable) items.push({ kind: "action", id: "add-tab", label: props.addLabel, icon: Plus, onSelect: () => emit("add") });
  (controller?.menu ?? useMenuRuntime()).openMenu({ id: menuId, source: "topbar", anchor: { element: event.currentTarget as HTMLElement }, items });
}

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

function handleWheel(event: WheelEvent): void {
  if (event.ctrlKey || event.deltaX !== 0 || event.deltaY === 0) {
    return;
  }
  const target = event.currentTarget as HTMLElement | null;
  if (!target || target.scrollWidth <= target.clientWidth) {
    return;
  }
  event.preventDefault();
  target.scrollLeft += event.deltaY;
}
</script>

<template>
  <div class="workbench-dynamic-tabs min-w-0 max-w-full flex-1" :class="{ 'is-compact-enabled': compact }">
  <div
    :class="[
      'workbench-dynamic-tabs-expanded max-w-full items-end overflow-hidden scrollbar-none flex min-w-0 flex-1 gap-1 overflow-x-auto',
      bordered ? 'border-b border-border-default' : ''
    ]"
    @wheel="handleWheel"
  >
    <div
      v-for="item in items"
      :key="item.id"
      class="group grid min-w-30 max-w-56 shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-1 rounded-md border border-border-subtle bg-surface-muted px-2 text-left text-small text-text-muted transition-colors hover:bg-surface-hover hover:text-text-secondary disabled:cursor-not-allowed disabled:opacity-50"
      :class="[
        size === 'sm' ? 'h-8' : 'h-9',
        modelValue === item.id ? 'rounded-t-md rounded-b-none border-border-default border-b-0 bg-surface-default text-text-secondary pb-px' : ''
      ]"
      :title="item.title || item.label"
      :draggable="draggable && !item.disabled"
      @contextmenu.prevent="emit('context', item.id, $event)"
      @dragstart="startDrag(item, $event)"
      @dragover.prevent
      @drop.prevent="dropOn(item, $event)"
      @dragend="draggingId = null"
    >
      <button type="button" class="flex min-w-0 h-full items-center gap-1 text-left disabled:cursor-not-allowed disabled:opacity-50" :disabled="item.disabled" :aria-pressed="modelValue === item.id" @click="selectTab(item.id)">
        <span class="min-w-0 truncate">{{ item.label }}</span>
        <span v-if="item.meta !== undefined" class="rounded bg-surface-input px-1 font-mono text-[10px] text-text-subtle">{{ item.meta }}</span>
      </button>
      <button
        v-if="item.closable"
        class="-mr-1 flex size-5 items-center justify-center rounded text-text-subtle opacity-70 hover:bg-surface-input hover:text-text-secondary group-hover:opacity-100"
        type="button"
        :title="`Close ${item.label}`"
        :aria-label="`Close ${item.label}`"
        :disabled="item.disabled"
        @click.stop="closeTab(item.id)"
      >
        <X class="size-3.5" aria-hidden="true" />
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
  <div v-if="compact" class="workbench-dynamic-tabs-compact min-w-0 items-center gap-1">
    <button type="button" class="flex min-w-0 flex-1 h-10 items-center gap-2 rounded border border-border-subtle bg-surface-muted px-2 text-small text-text-secondary" :aria-label="tabsLabel" aria-haspopup="menu" data-menu-trigger="true" @click="openTabs">
      <span class="min-w-0 flex-1 truncate">{{ activeItem?.label || tabsLabel }}</span>
      <span class="text-text-subtle">{{ items.length }}</span><ChevronDown class="size-4 shrink-0" aria-hidden="true" />
    </button>
    <button v-if="activeItem?.closable" type="button" class="flex size-10 shrink-0 items-center justify-center rounded hover:bg-surface-hover" :title="`Close ${activeItem.label}`" :aria-label="`Close ${activeItem.label}`" :disabled="activeItem.disabled" @click="closeTab(activeItem.id)"><X class="size-4" aria-hidden="true" /></button>
    <button v-if="addable" type="button" class="flex size-10 shrink-0 items-center justify-center rounded hover:bg-surface-hover" :title="addLabel" :aria-label="addLabel" @click="emit('add')"><Plus class="size-4" aria-hidden="true" /></button>
  </div>
  </div>
</template>

<style scoped>
.workbench-dynamic-tabs { container-type: inline-size; }
.workbench-dynamic-tabs-compact { display: none; }
@container (max-width: 480px) {
  .is-compact-enabled .workbench-dynamic-tabs-expanded { display: none; }
  .is-compact-enabled .workbench-dynamic-tabs-compact { display: flex; }
}
@media (any-pointer: coarse) {
  .workbench-dynamic-tabs-expanded > .group { min-height: 40px; }
  .workbench-dynamic-tabs-expanded > .group > button:last-child { min-width: 32px; min-height: 32px; }
}
</style>
