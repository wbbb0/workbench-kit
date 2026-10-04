<script setup lang="ts">
import { computed } from "vue";
import { WorkbenchButton } from "@workbench-kit/vue-workbench";
import FileLocationPicker from "./FileLocationPicker.vue";
import type { FileOperationRequest, FileLocationRoot, FileLocationClient, FileLocation } from "./operations.js";
const props = withDefaults(defineProps<{ request: FileOperationRequest; roots?: FileLocationRoot[]; locationClient?: FileLocationClient; pending?: boolean; error?: string; disabledReason?: string; targetDisabledReason?: (location: FileLocation) => string | undefined }>(), { roots: () => [] });
const emit = defineEmits<{ "update:request": [request: FileOperationRequest]; submit: [request: FileOperationRequest]; cancel: [] }>();
const label = computed(() => ({upload:"上传",copy:"复制",move:"移动",delete:"删除"}[props.request.kind]));
const items = computed(() => props.request.kind === "upload" ? props.request.uploads ?? [] : props.request.source?.entries ?? []);
const reason = computed(() => {
  const root = props.roots.find(item => item.id === props.request.target?.rootId);
  const rootReason = props.request.kind !== "delete" && props.request.target && (props.locationClient || props.roots.length) ? (!root ? "根目录不可用" : root.disabled ? root.disabledReason || "此位置不可用" : "") : "";
  return props.disabledReason || rootReason || (props.request.kind !== "delete" && !props.request.target ? "请先选择目标目录" : "") || (props.request.target && props.targetDisabledReason?.(props.request.target)) || (!items.value.length ? "没有待处理条目" : "");
});
function target(location: FileLocation) { emit("update:request", { ...props.request, target: location }); }
</script>
<template>
  <div class="flex min-h-0 flex-col gap-3">
    <slot name="summary" :request="request"><p>{{ label }} {{ items.length }} 个条目</p></slot>
    <div class="max-h-40 overflow-auto rounded border border-border-default p-2">
      <div v-for="(item,index) in items" :key="index" class="truncate text-sm">{{ 'relativePath' in item ? item.relativePath : item.name }}</div>
    </div>
    <slot name="target" :request="request" :set-target="target">
      <FileLocationPicker v-if="request.kind !== 'delete' && locationClient" :roots="roots" :client="locationClient" :model-value="request.target" :disabled="pending" :target-disabled-reason="targetDisabledReason" @select="target" />
      <p v-else-if="request.target" class="break-all">目标：{{ request.target.path || '/' }}</p>
    </slot>
    <slot :request="request" />
    <p v-if="request.kind === 'delete'" class="text-sm text-text-muted">确认删除以上条目。</p>
    <p v-if="error" role="alert" class="text-sm text-danger">{{ error }}</p>
    <p v-if="reason" class="text-sm text-text-muted">{{ reason }}</p>
    <div class="flex flex-wrap justify-end gap-2">
      <WorkbenchButton :disabled="pending" @click="emit('cancel')">取消</WorkbenchButton>
      <WorkbenchButton :variant="request.kind === 'delete' ? 'danger' : 'primary'" :disabled="pending || !!reason" @click="emit('submit', request)">{{ pending ? '正在处理…' : `确认${label}` }}</WorkbenchButton>
    </div>
  </div>
</template>
