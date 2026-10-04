<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { WorkbenchButton, TreeNodeShell } from "@workbench-kit/vue-workbench";
import type { FileLocation, FileLocationRoot, FileDirectoryEntry, FileLocationClient } from "./operations.js";
const props = withDefaults(defineProps<{ roots: FileLocationRoot[]; client: FileLocationClient; modelValue?: FileLocation | null; disabled?: boolean; selectLabel?: string; targetDisabledReason?: (location: FileLocation) => string | undefined }>(), { selectLabel: "选择此位置" });
const emit = defineEmits<{ "update:modelValue": [location: FileLocation | null]; select: [location: FileLocation] }>();
const current = ref<FileLocation | null>(props.modelValue ? { ...props.modelValue } : null);
const history = ref<FileLocation[]>([]);
const entries = ref<FileDirectoryEntry[]>([]);
const loading = ref(false);
const error = ref("");
const cursor = ref<string>();
let abort: AbortController | undefined;
const root = computed(() => props.roots.find(item => item.id === current.value?.rootId));
const disabledReason = computed(() => current.value && !root.value ? "根目录不可用" : root.value?.disabled ? root.value.disabledReason || "此位置不可用" : current.value ? props.targetDisabledReason?.(current.value) : "请先选择位置");
async function load(append = false) {
  abort?.abort(); const controller = new AbortController(); abort = controller;
  if (!current.value) { entries.value = []; cursor.value = undefined; return; }
  loading.value = true; error.value = "";
  try {
    const result = await props.client.listDirectories({ ...current.value }, { signal: controller.signal, ...(append && cursor.value ? { cursor: cursor.value } : {}) });
    if (controller.signal.aborted) return;
    entries.value = append ? [...entries.value, ...result.entries] : result.entries;
    cursor.value = result.nextCursor;
  } catch (cause) { if (!controller.signal.aborted) error.value = cause instanceof Error ? cause.message : String(cause); }
  finally { if (!controller.signal.aborted) loading.value = false; }
}
function navigate(location: FileLocation, remember = true) {
  if (remember && current.value) history.value.push({ ...current.value });
  current.value = { ...location }; entries.value = []; cursor.value = undefined;
  emit("update:modelValue", { ...location }); void load();
}
function clear() { abort?.abort(); current.value = null; entries.value = []; cursor.value = undefined; loading.value = false; history.value = []; error.value = ""; }
function back() { const location = history.value.pop(); if (location) navigate(location, false); else { clear(); emit("update:modelValue", null); } }
watch(() => props.modelValue, value => { if (value === null) { clear(); return; } if (value && (value.rootId !== current.value?.rootId || value.path !== current.value?.path)) navigate(value, false); });
if (current.value) void load();
onBeforeUnmount(() => abort?.abort());
</script>
<template>
  <div class="flex min-h-0 flex-col gap-3">
    <div class="flex min-w-0 items-center gap-2">
      <WorkbenchButton v-if="current" @click="back">返回</WorkbenchButton>
      <span class="min-w-0 flex-1 truncate" :title="current?.path">{{ current ? `${root?.label ?? current.rootId} / ${current.path}` : '选择根目录' }}</span>
      <WorkbenchButton v-if="current" :disabled="loading" @click="load()">刷新</WorkbenchButton>
    </div>
    <div class="min-h-0 flex-1 overflow-auto">
      <template v-if="!current">
        <div v-for="item in roots" :key="item.id" :title="item.disabledReason" class="py-1">
          <WorkbenchButton class="w-full justify-start" :disabled="item.disabled || disabled" @click="navigate({rootId:item.id,path:''})">{{ item.label }}</WorkbenchButton>
          <p v-if="item.disabledReason" class="text-xs text-text-muted">{{ item.disabledReason }}</p>
        </div>
      </template>
      <template v-else>
        <TreeNodeShell v-for="item in entries" :key="item.path" icon-mode="files" :collapsible="true" @toggle="!item.disabled && !disabled && navigate({rootId:current!.rootId,path:item.path})">
          <template #label><span class="flex min-h-11 items-center" :class="{'opacity-50':item.disabled || disabled}" :title="item.disabledReason">{{ item.name }}</span></template>
          <template #meta><span v-if="item.disabledReason" class="text-xs text-text-muted">{{ item.disabledReason }}</span></template>
        </TreeNodeShell>
        <p v-if="!loading && !entries.length && !error" class="py-4 text-text-muted">没有子目录</p>
        <WorkbenchButton v-if="cursor" :disabled="loading" @click="load(true)">加载更多</WorkbenchButton>
      </template>
      <p v-if="loading" role="status" class="py-3 text-text-muted">正在加载…</p>
      <p v-if="error" role="alert" class="py-3 text-danger">{{ error }}</p>
    </div>
    <p v-if="disabledReason && current" class="text-xs text-text-muted">{{ disabledReason }}</p>
    <WorkbenchButton v-if="current" :disabled="disabled || !!disabledReason || loading" @click="emit('select', {...current})">{{ selectLabel }}</WorkbenchButton>
  </div>
</template>
