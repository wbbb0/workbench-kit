<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { File, Folder, MoreHorizontal, ArrowDown, ArrowUp } from "lucide-vue-next";
import { WorkbenchButton, usePointerDrag, useCollectionSelection, useMarqueeSelection } from "@workbench-kit/vue-workbench";
import { FILE_WORKSPACE_DRAG_TYPE } from "./composables/useFileDrop.js";
import type { FileWorkspaceEntry } from "./operations.js";

const props = withDefaults(defineProps<{
  entries: FileWorkspaceEntry[]; selectedPaths?: string[]; focusedPath?: string | null;
  loading?: boolean; viewMode?: "list" | "grid"; gridSize?: number;
  sortBy?: string; sortDesc?: boolean; visibleColumns?: string[];
  compactBreakpoint?: number; draggable?: boolean; dropEnabled?: boolean;
  dropEffect?: (target: FileWorkspaceEntry | null, event: DragEvent) => "copy" | "move" | "none";
  dropHint?: string;
  /** 可选的列宽存储键；不配置时不访问localStorage。 */
  storageKey?: string;
}>(), { selectedPaths: () => [], focusedPath: null, viewMode: "list", gridSize: 120, visibleColumns: () => ["size", "modifiedAt", "type"], compactBreakpoint: 640 });
const emit = defineEmits<{
  setSelection: [paths: string[], focusedPath: string | null]; focusEntry: [entry: FileWorkspaceEntry];
  toggleSelection: [entry: FileWorkspaceEntry, additive: boolean]; openEntry: [entry: FileWorkspaceEntry];
  sort: [key: string]; selectAll: []; clearSelection: []; resizeGrid: [delta: number];
  entryAction: [entry: FileWorkspaceEntry, event: MouseEvent];
  dragEntries: [entries: FileWorkspaceEntry[], event: DragEvent]; dropEntries: [target: FileWorkspaceEntry | null, event: DragEvent];
}>();
const scrollEl = ref<HTMLElement | null>(null);
const width = ref(0); const height = ref(400); const scrollTop = ref(0);
const selectionMode = ref(false);
const dropTarget = ref<{ path: string | null; mode: "copy" | "move" } | null>(null);
const lastPointerType = ref("mouse");
const compact = computed(() => width.value > 0 && width.value < props.compactBreakpoint);
const rowHeight = computed(() => compact.value ? 68 : 44);
const grid = computed(() => !compact.value && props.viewMode === "grid");
const columns = computed(() => grid.value ? Math.max(1, Math.floor((width.value - 24 + 12) / (Math.max(96, props.gridSize) + 12))) : 1);
const cellHeight = computed(() => grid.value ? Math.max(96, props.gridSize) + 76 : rowHeight.value);
const count = computed(() => Math.ceil(props.entries.length / columns.value));
const start = computed(() => Math.max(0, Math.floor(scrollTop.value / cellHeight.value) - 6));
const end = computed(() => Math.min(count.value, start.value + Math.ceil(height.value / cellHeight.value) + 12));
const visible = computed(() => props.entries.slice(start.value * columns.value, end.value * columns.value).map((entry, i) => ({ entry, index: start.value * columns.value + i })));
const defaultSizes: Record<string,number> = { name:360,size:112,modifiedAt:160,type:112 };
const sizes = reactive<Record<string, number>>({ ...defaultSizes });
const config = [{key:"name",label:"名称",min:160},{key:"size",label:"大小",min:76},{key:"modifiedAt",label:"修改时间",min:112},{key:"type",label:"类型",min:88}];
function clampWidth(key: string, width: number) {
  const min = config.find(column => column.key === key)?.min ?? 80;
  const max = key === "name" ? 720 : key === "modifiedAt" ? 260 : 220;
  return Math.max(min,Math.min(max,Math.round(width)));
}
function restoreWidths() {
  Object.assign(sizes,defaultSizes);
  if (!props.storageKey || typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(props.storageKey);
    const saved: unknown = raw ? JSON.parse(raw) : null;
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return;
    for (const {key} of config) {
      const value = (saved as Record<string,unknown>)[key];
      if (typeof value === "number" && Number.isFinite(value)) sizes[key] = clampWidth(key,value);
    }
  } catch { /* Storage may be unavailable; column resizing remains usable. */ }
}
function persistWidths() {
  if (!props.storageKey || typeof window === "undefined") return;
  try { window.localStorage.setItem(props.storageKey,JSON.stringify(sizes)); } catch { /* Optional persistence. */ }
}
watch(() => props.storageKey,restoreWidths);
const activeColumns = computed(() => config.filter(column => column.key === "name" || props.visibleColumns.includes(column.key)));
const listWidth = computed(() => compact.value || grid.value ? width.value : Math.max(width.value, activeColumns.value.reduce((total,column) => total + sizes[column.key]!, 0) + 80));
const template = computed(() => activeColumns.value.map(column => `${sizes[column.key]}px`).join(" "));
const selection = useCollectionSelection({ keys: () => props.entries.filter(entry => !entry.disabledReason).map(entry => entry.path), selectedKeys: () => props.selectedPaths, focusedKey: () => props.focusedPath, onChange: (paths, focused) => emit("setSelection", paths, focused) });
const columnDrag = usePointerDrag<{key:string;width:number}>({ cursor:"col-resize", onMove({state,deltaX}) { sizes[state.key] = clampWidth(state.key,state.width + deltaX); }, onEnd: persistWidths });
const marquee = useMarqueeSelection({
  point(event) { const rect = scrollEl.value!.getBoundingClientRect(); return { x: event.clientX - rect.left + scrollEl.value!.scrollLeft, y: event.clientY - rect.top + scrollEl.value!.scrollTop - (!compact.value && !grid.value ? 36 : 0) }; },
  selectedKeys: () => props.selectedPaths,
  hitTest(rect) {
    const cellWidth = grid.value ? Math.max(0,(width.value - 24 - (columns.value - 1) * 12) / columns.value) : listWidth.value;
    return props.entries.filter((entry,index) => {
      if (entry.disabledReason) return false;
      const left = grid.value ? 12 + (index % columns.value) * (cellWidth + 12) : 0;
      const top = Math.floor(index / columns.value) * cellHeight.value;
      return rect.left <= left + cellWidth && rect.left + rect.width >= left && rect.top <= top + cellHeight.value && rect.top + rect.height >= top;
    }).map(entry => entry.path);
  }, onChange(paths) { emit("setSelection",paths,props.focusedPath); }
});
function pointerDown(event: PointerEvent) {
  lastPointerType.value = event.pointerType;
  if ((event.target as HTMLElement).closest('[data-file-entry]')) marquee.moved.value = false;
  if (compact.value || event.pointerType === "touch" || (event.target as HTMLElement).closest('[data-file-entry],button,input,[data-column-resize]')) return;
  marquee.start(event);
}
function click(entry: FileWorkspaceEntry,event: MouseEvent) {
  if (entry.disabledReason) return;
  if (marquee.moved.value) { marquee.moved.value = false; return; }
  if (selectionMode.value) selection.select(entry.path,{additive:true});
  else if (lastPointerType.value === "touch" || (event as PointerEvent).pointerType === "touch") { if (entry.openDisabledReason) selection.select(entry.path); emit("focusEntry",entry); if (!entry.openDisabledReason) emit("openEntry",entry); return; }
  else selection.select(entry.path,{additive:event.ctrlKey || event.metaKey,range:event.shiftKey});
  emit("focusEntry",entry);
}
function open(entry: FileWorkspaceEntry) { if (!selectionMode.value && !entry.disabledReason && !entry.openDisabledReason) emit("openEntry",entry); }
function action(entry: FileWorkspaceEntry,event: MouseEvent) { event.preventDefault(); event.stopPropagation(); emit("entryAction",entry,event); }
function drag(entry: FileWorkspaceEntry,event: DragEvent) {
  const entries = selection.selected.value.has(entry.path) ? props.entries.filter(item => selection.selected.value.has(item.path)) : [entry];
  if (!props.draggable || compact.value || entries.some(item => item.disabledReason || item.draggable === false)) { event.preventDefault(); event.stopPropagation(); return; }
  emit("dragEntries",entries,event);
}
function acceptsDrag(event: DragEvent) { return !!event.dataTransfer && Array.from(event.dataTransfer.types).some(type => type === "Files" || type === FILE_WORKSPACE_DRAG_TYPE); }
function targetFor(entry?: FileWorkspaceEntry | null) { return entry?.kind === "directory" ? entry : null; }
function drop(entry: FileWorkspaceEntry | null,event: DragEvent) {
  dropTarget.value = null;
  if (!props.dropEnabled || !acceptsDrag(event)) return;
  event.preventDefault(); event.stopPropagation();
  const target = targetFor(entry);
  if (target?.disabledReason || props.dropEffect?.(target,event) === "none") return;
  emit("dropEntries",target,event);
}
function dragover(event: DragEvent, entry?: FileWorkspaceEntry) {
  if (!props.dropEnabled || !event.dataTransfer || !acceptsDrag(event)) return;
  const target = targetFor(entry);
  const mode = target?.disabledReason ? "none" : props.dropEffect?.(target,event) ?? "copy";
  event.preventDefault(); event.dataTransfer.dropEffect = mode;
  dropTarget.value = mode === "none" ? null : { path: target?.path ?? null, mode };
}
function dragleave(event: DragEvent) { if (!(event.relatedTarget instanceof Node) || !scrollEl.value?.contains(event.relatedTarget)) dropTarget.value = null; }
let query = ""; let queryTime = 0;
function keydown(event: KeyboardEvent) {
  if ((event.target as HTMLElement).closest('button,input,select,textarea')) return;
  const focused = props.entries.findIndex(entry => entry.path === props.focusedPath);
  const entry = props.entries[Math.max(0,focused)];
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") { event.preventDefault(); selection.all(); emit("selectAll"); return; }
  if (event.key === "Escape") { marquee.stop(); selection.clear(); selectionMode.value = false; emit("clearSelection"); return; }
  if (event.key === "Enter" && entry) { event.preventDefault(); open(entry); return; }
  if (event.key === " " && entry) { event.preventDefault(); selection.select(entry.path,{additive:true}); return; }
  const increments: Record<string,number> = { ArrowDown:columns.value,ArrowUp:-columns.value,ArrowRight:1,ArrowLeft:-1,Home:-props.entries.length,End:props.entries.length };
  if (event.key in increments) {
    event.preventDefault(); let index = Math.min(props.entries.length - 1,Math.max(0,focused < 0 && event.key !== "End" ? 0 : focused + increments[event.key]!));
    const step = event.key === "Home" ? 1 : event.key === "End" ? -1 : Math.sign(increments[event.key]!) || 1;
    while (index >= 0 && index < props.entries.length && props.entries[index]?.disabledReason) index += step;
    const next = props.entries[index]; if (!next) return;
    if (event.ctrlKey || event.metaKey) { if (event.shiftKey) selection.select(next.path,{range:true,additive:true}); }
    else selection.select(next.path,{range:event.shiftKey});
    emit("focusEntry",next);
    const top = Math.floor(index / columns.value) * cellHeight.value;
    if (scrollEl.value) { if (top < scrollTop.value) scrollEl.value.scrollTop = top; else if (top + cellHeight.value > scrollTop.value + height.value) scrollEl.value.scrollTop = top + cellHeight.value - height.value; }
  } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
    const now = Date.now(); query = now - queryTime > 900 ? event.key : query + event.key; queryTime = now;
    const next = props.entries.find(item => !item.disabledReason && item.name.toLocaleLowerCase().startsWith(query.toLocaleLowerCase()));
    if (next) { selection.select(next.path); emit("focusEntry",next); const index = props.entries.indexOf(next); if(scrollEl.value) scrollEl.value.scrollTop = Math.floor(index / columns.value) * cellHeight.value; }
  }
}
function bytes(value?: number) { if (value == null) return "—"; if(value < 1024) return `${value} B`; const unit = Math.min(4,Math.floor(Math.log(value)/Math.log(1024))); return `${(value / 1024 ** unit).toFixed(1)} ${['B','KB','MB','GB','TB'][unit]}`; }
function meta(entry: FileWorkspaceEntry,key:string) { if(key === "size") return entry.kind === "directory" ? "—" : bytes(entry.sizeBytes); if(key === "modifiedAt") return entry.updatedAtMs == null ? "—" : new Date(entry.updatedAtMs).toLocaleString(); return entry.typeLabel ?? (entry.kind === "directory" ? "目录" : "文件"); }
let observer: ResizeObserver | undefined;
onMounted(() => { restoreWidths(); if (!scrollEl.value) return; observer = new ResizeObserver(([box]) => { if(box) {width.value = box.contentRect.width; height.value = box.contentRect.height;} }); width.value = scrollEl.value.clientWidth; height.value = scrollEl.value.clientHeight || 400; observer.observe(scrollEl.value); });
onBeforeUnmount(() => observer?.disconnect());
watch([columns,cellHeight], async ([cols,cell],[oldCols,oldCell]) => { const index = Math.floor(scrollTop.value / oldCell) * oldCols; await nextTick(); if(scrollEl.value) scrollEl.value.scrollTop = Math.floor(index / cols) * cell; });
watch(() => props.entries, async () => { await nextTick(); if(scrollEl.value) scrollTop.value = scrollEl.value.scrollTop; });
</script>
<template>
  <div class="file-entry-panel flex min-h-0 min-w-0 flex-1 flex-col" :class="{ 'is-compact':compact }">
    <div v-if="compact || selectionMode || lastPointerType === 'touch'" class="flex min-h-11 shrink-0 items-center justify-between gap-2 border-b border-border-default px-2">
      <span class="text-sm text-text-muted">{{ selectionMode ? `已选择 ${selectedPaths.length} 项` : `${entries.length} 个条目` }}</span>
      <div class="flex items-center gap-2"><WorkbenchButton v-if="selectionMode" @click="selection.all()">全选</WorkbenchButton><WorkbenchButton @click="selectionMode = !selectionMode">{{ selectionMode ? '完成' : '选择' }}</WorkbenchButton></div>
      <slot v-if="selectionMode" name="selection-actions" :selected-paths="selectedPaths" />
    </div>
    <div ref="scrollEl" class="relative min-h-0 flex-1 overflow-auto outline-none" tabindex="0" role="listbox" aria-label="文件" aria-multiselectable="true" :aria-busy="loading" @scroll="scrollTop = ($event.target as HTMLElement).scrollTop" @keydown="keydown" @pointerdown="pointerDown" @dragover="dragover($event)" @dragleave="dragleave" @dragend="dropTarget = null" @drop="drop(null,$event)" @wheel.ctrl.prevent="emit('resizeGrid',$event.deltaY < 0 ? 8 : -8)">
      <div v-if="!compact && !grid" class="file-list-header sticky top-0 z-10 flex h-9 items-center border-b border-border-default bg-surface-panel text-xs text-text-muted" :style="{width:`${listWidth}px`}">
        <div class="grid pl-3" :style="{gridTemplateColumns:template}"><div v-for="column in activeColumns" :key="column.key" class="relative flex items-center pr-3"><button class="flex items-center gap-1" @click="emit('sort',column.key)">{{ column.label }}<component v-if="sortBy === column.key" :is="sortDesc ? ArrowDown : ArrowUp" :size="12" /></button><span data-column-resize class="absolute right-0 h-7 w-3 cursor-col-resize touch-none" @pointerdown.stop="columnDrag.start($event,{key:column.key,width:sizes[column.key]!})" /></div></div>
      </div>
      <div class="relative" :style="{height:`${count * cellHeight}px`,width:`${listWidth}px`}">
        <div class="absolute left-0 top-0 w-full" :style="{transform:`translateY(${start * cellHeight}px)`,display:grid?'grid':'block',gridTemplateColumns:grid?`repeat(${columns},minmax(0,1fr))`:undefined,columnGap:grid?'12px':undefined,paddingInline:grid?'12px':undefined}">
          <div v-for="{entry} in visible" :key="entry.path" data-file-entry role="option" :aria-selected="selection.selected.value.has(entry.path)" :aria-disabled="!!entry.disabledReason" :title="entry.disabledReason || entry.openDisabledReason" :draggable="draggable && !compact && !entry.disabledReason && entry.draggable !== false" class="file-entry group relative flex min-w-0 items-center gap-2 border-b border-border-default px-3" :class="{'file-entry-selected':selection.selected.value.has(entry.path),'file-entry-focused':focusedPath === entry.path,'file-entry-grid':grid,'file-entry-drop-target':dropTarget?.path === entry.path}" :style="{height:`${cellHeight}px`}" @pointerdown="lastPointerType = $event.pointerType" @click="click(entry,$event)" @dblclick="lastPointerType !== 'touch' && open(entry)" @contextmenu="action(entry,$event)" @dragstart="drag(entry,$event)" @dragover.stop="dragover($event,entry)" @drop="drop(entry,$event)">
            <input v-if="selectionMode" type="checkbox" :checked="selection.selected.value.has(entry.path)" :aria-label="`选择 ${entry.name}`" class="size-4 shrink-0" @click.stop="selection.select(entry.path,{additive:true})" @pointerdown.stop>
            <div v-if="compact || grid" class="shrink-0"><slot name="thumbnail" :entry="entry" :size="grid ? Math.max(96,gridSize) : 36"><component :is="entry.kind === 'directory' ? Folder : File" :size="grid?Math.max(48,gridSize/2):28" class="text-text-muted" /></slot></div>
            <div v-if="compact || grid" class="min-w-0 flex-1"><div class="file-entry-name" :class="grid ? 'file-entry-grid-name' : 'truncate'" :title="entry.name">{{ entry.name }}</div><div v-if="compact" class="truncate text-xs text-text-muted"><slot name="entry-meta" :entry="entry">{{ meta(entry,'size') }} · {{ meta(entry,'modifiedAt') }}</slot></div></div>
            <div v-else class="grid min-w-0" :style="{gridTemplateColumns:template}"><div v-for="column in activeColumns" :key="column.key" class="flex min-w-0 items-center gap-2 pr-3"><template v-if="column.key === 'name'"><slot name="thumbnail" :entry="entry" :size="24"><component :is="entry.kind === 'directory' ? Folder : File" :size="20" class="shrink-0 text-text-muted" /></slot><span class="truncate" :title="entry.name">{{ entry.name }}</span></template><span v-else class="truncate text-xs text-text-muted" :title="column.key === 'type' && entry.openDisabledReason ? `${meta(entry,column.key)}：${entry.openDisabledReason}` : meta(entry,column.key)">{{ meta(entry,column.key) }}</span></div></div>
            <div class="file-entry-actions" @click.stop @dblclick.stop @pointerdown.stop><slot name="actions" :entry="entry" :action="(event:MouseEvent)=>action(entry,event)"><button type="button" class="flex size-11 items-center justify-center rounded hover:bg-surface-hover" :aria-label="`${entry.name} 的更多操作`" @click="action(entry,$event)"><MoreHorizontal :size="18" /></button></slot></div>
          </div>
        </div>
        <div v-if="marquee.rect.value" class="pointer-events-none absolute border border-accent bg-accent/15" :style="{left:`${marquee.rect.value.left}px`,top:`${marquee.rect.value.top}px`,width:`${marquee.rect.value.width}px`,height:`${marquee.rect.value.height}px`}" />
      </div>
      <div v-if="dropTarget" class="pointer-events-none sticky bottom-2 z-20 mx-2 rounded border border-accent bg-surface-panel px-3 py-2 text-sm" role="status">{{ dropHint || `${dropTarget.mode === 'move' ? '移动' : '复制'}到${dropTarget.path === null ? '当前目录' : entries.find(entry => entry.path === dropTarget!.path)?.name ?? dropTarget.path}` }}</div>
      <p v-if="loading" role="status" class="p-4 text-sm text-text-muted">正在加载…</p>
      <div v-else-if="!entries.length" class="p-8 text-center text-sm text-text-muted"><slot name="empty">此目录为空</slot></div>
    </div>
  </div>
</template>
<style scoped>
.file-entry:hover { background: var(--surface-hover,rgba(127,127,127,.08)); }
.file-entry-selected { background: var(--surface-selected,rgba(80,130,220,.18)); }
.file-entry-drop-target { outline:2px solid var(--accent,#6789c6); outline-offset:-2px; background:var(--surface-selected,rgba(80,130,220,.18)); }
.file-entry-focused { outline: 1px solid var(--accent,#6789c6); outline-offset:-1px; }
.file-entry-grid { flex-direction:column; justify-content:center; padding:8px; border:0; text-align:center; }
.file-entry-grid-name { display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:3; overflow:hidden; overflow-wrap:anywhere; font-size:12px; line-height:16px; max-height:48px; }
.file-entry-grid .file-entry-actions { position:absolute; top:0; right:0; }
.file-entry-actions { margin-left:auto; flex-shrink:0; }
.is-compact .file-entry { font-size:14px; }
@media (hover:hover) and (pointer:fine) { .file-entry-actions { opacity:0; } .file-entry:hover .file-entry-actions,.file-entry:focus-within .file-entry-actions { opacity:1; } }
</style>
