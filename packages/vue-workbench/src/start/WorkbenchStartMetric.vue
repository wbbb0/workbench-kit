<script setup lang="ts">
withDefaults(defineProps<{
  label: string;
  value: string | number;
  detail?: string;
  tone?: "neutral" | "info" | "success" | "warning" | "danger";
}>(), {
  detail: "",
  tone: "neutral"
});
</script>

<template>
  <div class="rounded-md border border-border-subtle bg-surface-input p-3">
    <div class="flex items-center justify-between gap-3">
      <span class="truncate text-small text-text-muted">{{ label }}</span>
      <span
        class="size-2 rounded-full"
        :class="{
          'bg-text-subtle': tone === 'neutral',
          'bg-info': tone === 'info',
          'bg-success': tone === 'success',
          'bg-warning': tone === 'warning',
          'bg-danger': tone === 'danger'
        }"
      />
    </div>
    <div class="mt-2 truncate text-lg font-semibold text-text-secondary">{{ value }}</div>
    <div v-if="detail" class="mt-1 truncate text-small text-text-subtle">{{ detail }}</div>
  </div>
</template>

