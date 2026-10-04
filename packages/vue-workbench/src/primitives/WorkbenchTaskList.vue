<script setup lang="ts">
import WorkbenchButton from "./WorkbenchButton.vue";
import type { WorkbenchTaskItem, WorkbenchTaskStatus } from "./taskListTypes.js";
withDefaults(defineProps<{ tasks: readonly WorkbenchTaskItem[]; emptyLabel?: string }>(), { emptyLabel: "暂无任务" });
const emit = defineEmits<{ cancel: [id: string]; retry: [id: string] }>();
const statusLabels: Record<WorkbenchTaskStatus, string> = { queued: "等待中", running: "进行中", completed: "已完成", failed: "失败", cancelled: "已取消" };
function progress(task: WorkbenchTaskItem) {
  if (!task.total || task.total <= 0) return undefined;
  return Math.max(0, Math.min(task.total, task.completed ?? 0));
}
function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(units.length - 1, bytes > 0 ? Math.max(0, Math.floor(Math.log(bytes) / Math.log(1024))) : 0);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}
</script>

<template>
  <ul v-if="tasks.length" class="divide-y divide-border-subtle" aria-label="任务">
    <li v-for="task in tasks" :key="task.id" class="min-w-0 space-y-2 px-3 py-3">
      <div class="flex min-w-0 items-start gap-2">
        <div class="min-w-0 flex-1">
          <div class="truncate text-ui text-text-secondary" :title="task.label">{{ task.label }}</div>
          <div class="mt-1 text-small text-text-muted" role="status">{{ statusLabels[task.status] }}<span v-if="task.total && task.total > 0"> · {{ progress(task) }} / {{ task.total }}</span><span v-if="task.bytes !== undefined"> · {{ formatBytes(task.bytes) }}</span></div>
        </div>
        <WorkbenchButton v-if="task.cancellable && (task.status === 'running' || task.status === 'queued')" label="取消" variant="ghost" @click="emit('cancel', task.id)" />
        <WorkbenchButton v-if="task.retryable && (task.status === 'failed' || task.status === 'cancelled')" label="重试" @click="emit('retry', task.id)" />
      </div>
      <progress v-if="task.status === 'running' || task.status === 'queued'" class="h-1.5 w-full accent-accent" :aria-label="task.label" :value="progress(task)" :max="task.total && task.total > 0 ? task.total : undefined" />
      <p v-if="task.error" class="break-words text-small text-danger" role="alert">{{ task.error }}</p>
      <slot name="details" :task="task" />
    </li>
  </ul>
  <div v-else class="px-3 py-6 text-center text-small text-text-subtle">{{ emptyLabel }}</div>
</template>
