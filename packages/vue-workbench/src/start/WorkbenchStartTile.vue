<script setup lang="ts">
withDefaults(defineProps<{
  title: string;
  description?: string;
  meta?: string;
  active?: boolean;
}>(), {
  description: "",
  meta: "",
  active: false
});
</script>

<template>
  <div
    class="group flex min-h-36 flex-col justify-between rounded-md border bg-surface-input p-3 transition hover:bg-surface-hover"
    :class="active ? 'border-border-focus' : 'border-border-subtle'"
  >
    <div>
      <div class="mb-5 flex items-start justify-between gap-3">
        <div class="flex size-8 items-center justify-center rounded bg-surface-muted text-text-accent">
          <slot name="icon" />
        </div>
        <span v-if="meta" class="rounded border border-border-subtle px-1.5 py-0.5 text-small text-text-subtle">{{ meta }}</span>
      </div>
      <h3 class="text-ui font-medium text-text-secondary">{{ title }}</h3>
      <p v-if="description" class="mt-1 line-clamp-2 text-small leading-5 text-text-muted">{{ description }}</p>
    </div>
    <div v-if="$slots.footer" class="mt-4 border-t border-border-subtle pt-3 text-small text-text-subtle">
      <slot name="footer" />
    </div>
  </div>
</template>

