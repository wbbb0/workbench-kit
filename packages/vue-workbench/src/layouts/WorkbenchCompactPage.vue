<script setup lang="ts">
withDefaults(defineProps<{
  title: string;
  subtitle?: string;
  homeHref?: string;
  homeLabel?: string;
  contentClass?: string;
}>(), {
  subtitle: "",
  homeHref: "",
  homeLabel: "Home",
  contentClass: ""
});
</script>

<template>
  <div class="flex h-full min-h-dvh flex-col overflow-hidden bg-surface-app text-text-primary">
    <header class="flex h-9 shrink-0 items-center gap-2 border-b border-border-default bg-surface-sidebar px-2">
      <a
        v-if="homeHref"
        :href="homeHref"
        class="flex h-6 items-center px-2 text-small text-text-muted hover:bg-surface-hover hover:text-text-primary"
      >
        {{ homeLabel }}
      </a>
      <div class="min-w-0 flex flex-1 items-baseline gap-2">
        <h1 class="truncate text-ui font-medium text-text-secondary">{{ title }}</h1>
        <span v-if="subtitle" class="hidden truncate text-small text-text-subtle sm:inline">{{ subtitle }}</span>
      </div>
      <div v-if="$slots.actions" class="flex shrink-0 items-center gap-1">
        <slot name="actions" />
      </div>
    </header>

    <main class="min-h-0 flex-1 overflow-hidden">
      <div class="scrollbar-thin h-full min-h-0 overflow-auto" :class="contentClass">
        <slot />
      </div>
    </main>
  </div>
</template>
