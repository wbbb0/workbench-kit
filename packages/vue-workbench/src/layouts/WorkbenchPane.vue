<script setup lang="ts">
withDefaults(defineProps<{
  title?: string;
  subtitle?: string;
  padded?: boolean;
}>(), {
  title: "",
  subtitle: "",
  padded: true
});
</script>

<template>
  <section class="flex min-h-0 flex-col overflow-hidden border border-border-default bg-surface-panel">
    <header
      v-if="title || subtitle || $slots.actions"
      class="flex h-8 shrink-0 items-center gap-2 border-b border-border-default bg-surface-sidebar px-3"
    >
      <div class="min-w-0 flex flex-1 items-baseline gap-2">
        <h2 v-if="title" class="truncate text-small font-semibold text-text-secondary">{{ title }}</h2>
        <span v-if="subtitle" class="hidden truncate text-small text-text-subtle sm:inline">{{ subtitle }}</span>
      </div>
      <div v-if="$slots.actions" class="flex shrink-0 items-center gap-1">
        <slot name="actions" />
      </div>
    </header>
    <div class="min-h-0 flex-1 overflow-hidden" :class="padded ? 'p-3' : ''">
      <slot />
    </div>
  </section>
</template>
