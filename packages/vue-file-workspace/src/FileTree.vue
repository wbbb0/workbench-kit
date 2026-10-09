<script setup lang="ts">
import { computed } from "vue";
import { FileText, Image as ImageIcon, File, Folder, FolderOpen, ChevronDown, ChevronRight } from "lucide-vue-next";
import { TreeNodeShell } from "@workbench-kit/vue-workbench";
import type { LocalFileItem } from "./types";

defineOptions({ name: "WorkspaceFileTree" });
defineSlots<{ actions?: (props: { item: LocalFileItem }) => unknown; directoryEnd?: (props: { item: LocalFileItem }) => unknown; meta?: (props: { item: LocalFileItem }) => unknown }>();

const props = withDefaults(defineProps<{
  /** 当前层要渲染的文件/目录列表。 */
  items: LocalFileItem[];
  /** 已展开目录 path 列表。 */
  expandedPaths: string[];
  /** 目录 path 到其子项列表的缓存。 */
  itemsByPath: Record<string, LocalFileItem[]>;
  /** 当前选中的文件或目录 path。 */
  selectedPath: string | null;
  /** 选择模式。multiple 模式使用 checkbox，并由调用方维护级联选择状态。 */
  selectionMode?: "single" | "multiple";
  /** multiple 模式中完全选中的 path。 */
  selectedPaths?: string[];
  /** multiple 模式中部分选中的目录 path。 */
  indeterminatePaths?: string[];
  /** 当前递归深度。根层默认为 0。 */
  depth?: number;
  /** 默认关闭；拖放内容由调用方设置/读取。 */
  draggable?: boolean;
  dropEnabled?: boolean;
  touchDensity?: boolean;
  /** 可选紧凑行高；触摸密度开启时仍保留较大点击区域。 */
  compact?: boolean;
  showActions?: boolean;
  /** 保留默认点击目录展开；开启后目录label导航、独立按钮展开。 */
  directoryNavigation?: boolean;
  /** 显式开启右键菜单入口，默认不拦截浏览器contextmenu。 */
  contextActions?: boolean;
}>(), {
  depth: 0,
  selectionMode: "single",
  selectedPaths: () => [],
  indeterminatePaths: () => []
});

const emit = defineEmits<{
  toggleDirectory: [path: string];
  selectItem: [item: LocalFileItem];
  toggleSelection: [item: LocalFileItem, selected: boolean];
  dragItem: [item: LocalFileItem, event: DragEvent];
  dropItem: [item: LocalFileItem, event: DragEvent];
  itemAction: [item: LocalFileItem, event: MouseEvent];
}>();

const expandedSet = computed(() => new Set(props.expandedPaths));
const selectedSet = computed(() => new Set(props.selectedPaths));
const indeterminateSet = computed(() => new Set(props.indeterminatePaths));

function itemIcon(item: LocalFileItem) {
  if (/\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(item.name)) {
    return ImageIcon;
  }
  if (/\.(txt|md|json|ya?ml|log|ts|tsx|js|jsx|vue|css|html)$/i.test(item.name)) {
    return FileText;
  }
  return File;
}

function context(item: LocalFileItem, event: MouseEvent) {
  if (!props.contextActions) return;
  event.preventDefault(); event.stopPropagation(); emit("itemAction",item,event);
}

function forwardToggleSelection(item: LocalFileItem, selected: boolean) {
  emit("toggleSelection", item, selected);
}
</script>

<template>
  <div class="flex w-max min-w-full flex-col gap-0.5">
    <template v-for="item in items" :key="item.path">
      <TreeNodeShell
        :draggable="draggable"
        :class="{ 'file-tree-touch': touchDensity }"
        @contextmenu="context(item,$event)"
        @dragstart.stop="emit('dragItem', item, $event)"
        @dragover="dropEnabled && item.kind === 'directory' && $event.preventDefault()"
        @drop="dropEnabled && item.kind === 'directory' && ($event.preventDefault(), $event.stopPropagation(), emit('dropItem',item,$event))"
        :collapsible="item.kind === 'directory' && !directoryNavigation"
        :expanded="expandedSet.has(item.path)"
        :selected="selectionMode === 'single' && selectedPath === item.path"
        :child-inset="false"
        :indent-px="props.depth * 22"
        icon-mode="files"
        @toggle="emit('toggleDirectory', item.path)"
        @select="emit('selectItem', item)"
      >
        <template v-if="selectionMode === 'multiple' || (directoryNavigation && item.kind === 'directory')" #leading>
          <button v-if="directoryNavigation && item.kind === 'directory'" type="button" class="flex shrink-0 items-center justify-center" :class="compact && !touchDensity ? 'size-6' : 'size-9'" :aria-label="`${expandedSet.has(item.path) ? '折叠' : '展开'} ${item.name}`" :aria-expanded="expandedSet.has(item.path)" @click.stop="emit('toggleDirectory',item.path)"><component :is="expandedSet.has(item.path) ? ChevronDown : ChevronRight" :size="14" /></button>
          <input v-if="selectionMode === 'multiple'"
            type="checkbox"
            class="size-4 shrink-0"
            :aria-label="`Select ${item.name}`"
            :checked="selectedSet.has(item.path)"
            :indeterminate="indeterminateSet.has(item.path)"
            @pointerdown.stop
            @click.stop
            @change="emit('toggleSelection', item, ($event.target as HTMLInputElement).checked)"
          />
        </template>
        <template #icon>
          <component
            v-if="item.kind !== 'directory' || directoryNavigation"
            :is="item.kind === 'directory' ? (expandedSet.has(item.path) ? FolderOpen : Folder) : itemIcon(item)"
            :size="13"
            :stroke-width="1.8"
            class="shrink-0 text-text-muted"
          />
        </template>
        <template #label>
          <span class="tree-label">{{ item.name }}</span>
        </template>
        <template v-if="showActions || $slots.actions" #actions>
          <slot name="actions" :item="item"><button type="button" class="flex shrink-0 items-center justify-center rounded hover:bg-surface-hover" :class="compact && !touchDensity ? 'size-6' : 'size-9'" :aria-label="`${item.name} 的更多操作`" @click.stop="emit('itemAction',item,$event)">⋯</button></slot>
        </template>
        <template #meta>
          <slot name="meta" :item="item"><span class="tree-meta">{{ item.kind === "directory" ? "目录" : "文件" }}</span></slot>
        </template>

        <template v-if="item.kind === 'directory' && expandedSet.has(item.path)">
          <div>
            <WorkspaceFileTree
              :items="itemsByPath[item.path] ?? []"
              :expanded-paths="expandedPaths"
              :items-by-path="itemsByPath"
              :selected-path="selectedPath"
              :selection-mode="selectionMode"
              :selected-paths="selectedPaths"
              :indeterminate-paths="indeterminatePaths"
              :depth="props.depth + 1"
              :draggable="draggable" :drop-enabled="dropEnabled" :touch-density="touchDensity" :compact="compact" :show-actions="showActions" :directory-navigation="directoryNavigation" :context-actions="contextActions"
              @drag-item="(item,event) => emit('dragItem',item,event)"
              @drop-item="(item,event) => emit('dropItem',item,event)"
              @item-action="(item,event) => emit('itemAction',item,event)"
              @toggle-directory="emit('toggleDirectory', $event)"
              @select-item="emit('selectItem', $event)"
              @toggle-selection="forwardToggleSelection"
            >
              <template v-if="$slots.actions" #actions="{ item }: { item: LocalFileItem }"><slot name="actions" :item="item" /></template>
              <template v-if="$slots.meta" #meta="{ item }: { item: LocalFileItem }"><slot name="meta" :item="item" /></template>
              <template v-if="$slots.directoryEnd" #directoryEnd="{ item }: { item: LocalFileItem }"><slot name="directoryEnd" :item="item" /></template>
            </WorkspaceFileTree>
            <slot name="directoryEnd" :item="item" />
          </div>
        </template>
      </TreeNodeShell>
    </template>
  </div>
</template>

<style scoped>
.file-tree-touch :deep(.tree-shell-header > button) { min-height:44px; }
</style>
