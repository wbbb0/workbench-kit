<script setup lang="ts">
withDefaults(defineProps<{
  title?: string;
  subtitle?: string;
}>(), {
  title: "",
  subtitle: ""
});
</script>

<template>
  <section class="rounded-lg border border-border-default bg-surface-panel">
    <header v-if="title || subtitle || $slots.actions" class="flex items-start justify-between gap-3 border-b border-border-subtle px-4 py-3">
      <div class="min-w-0">
        <h2 v-if="title" class="truncate text-ui font-medium text-text-secondary">{{ title }}</h2>
        <p v-if="subtitle" class="mt-0.5 text-small text-text-muted">{{ subtitle }}</p>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <slot name="actions" />
      </div>
    </header>
    <div class="p-3 sm:p-4">
      <slot />
    </div>
  </section>
</template>

