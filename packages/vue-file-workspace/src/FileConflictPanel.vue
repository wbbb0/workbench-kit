<script setup lang="ts">
import { ref } from "vue";
import { WorkbenchButton } from "@workbench-kit/vue-workbench";
import type { FileOperationConflict, FileConflictResolution } from "./operations.js";
withDefaults(defineProps<{ conflict: FileOperationConflict; pending?: boolean; allowApplyToAll?: boolean }>(), { allowApplyToAll: true });
const emit = defineEmits<{ resolve: [resolution: FileConflictResolution, applyToAll: boolean]; cancel: [] }>();
const applyToAll = ref(false);
const labels: Record<FileConflictResolution, string> = { skip: "跳过", "keep-both": "保留两者", replace: "替换" };
function format(item: { sizeBytes?: number; updatedAtMs?: number }) { return [item.sizeBytes == null ? '' : `${item.sizeBytes.toLocaleString()} B`, item.updatedAtMs == null ? '' : new Date(item.updatedAtMs).toLocaleString()].filter(Boolean).join(' · '); }
</script>
<template>
  <div class="flex flex-col gap-4">
    <p class="break-all">目标已存在同名条目：{{ conflict.existing.name }}</p>
    <div class="grid gap-3 sm:grid-cols-2">
      <div class="min-w-0 rounded border border-border-default p-3"><p>待处理条目</p><p class="break-all text-sm">{{ conflict.incoming.path }}</p><p class="text-xs text-text-muted">{{ format(conflict.incoming) }}</p><slot name="incoming" :entry="conflict.incoming" /></div>
      <div class="min-w-0 rounded border border-border-default p-3"><p>已有条目</p><p class="break-all text-sm">{{ conflict.existing.path }}</p><p class="text-xs text-text-muted">{{ format(conflict.existing) }}</p><slot name="existing" :entry="conflict.existing" /></div>
    </div>
    <label v-if="allowApplyToAll" class="flex min-h-11 items-center gap-2"><input v-model="applyToAll" type="checkbox" :disabled="pending">应用到后续冲突</label>
    <div class="flex flex-wrap justify-end gap-2">
      <WorkbenchButton :disabled="pending" @click="emit('cancel')">取消</WorkbenchButton>
      <WorkbenchButton v-for="resolution in conflict.allowedResolutions ?? ['skip','keep-both','replace'] as FileConflictResolution[]" :key="resolution" :variant="resolution === 'replace' ? 'danger' : 'secondary'" :disabled="pending" @click="emit('resolve', resolution, applyToAll && allowApplyToAll)">{{ labels[resolution] }}</WorkbenchButton>
    </div>
  </div>
</template>
