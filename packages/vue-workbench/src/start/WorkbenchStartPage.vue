<script setup lang="ts">
import { computed, useSlots } from "vue";

withDefaults(defineProps<{
  eyebrow?: string;
  title: string;
  subtitle?: string;
}>(), {
  eyebrow: "",
  subtitle: ""
});

const slots = useSlots();
const hasAside = computed(() => Boolean(slots.aside));
</script>

<template>
  <main class="min-h-dvh overflow-auto bg-surface-app text-text-primary">
    <div class="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4 py-4 sm:px-6 lg:px-8">
      <header class="flex flex-wrap items-center justify-between gap-4 border-b border-border-default pb-4">
        <div class="min-w-0">
          <div v-if="eyebrow" class="mb-1 text-small tracking-[0.08em] text-text-subtle uppercase">{{ eyebrow }}</div>
          <h1 class="truncate text-xl font-semibold text-text-secondary sm:text-2xl">{{ title }}</h1>
          <p v-if="subtitle" class="mt-1 max-w-3xl text-ui text-text-muted">{{ subtitle }}</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <slot name="actions" />
        </div>
      </header>

      <section class="grid flex-1 gap-4 py-4" :class="hasAside ? 'lg:grid-cols-[1fr_20rem]' : ''">
        <div class="min-w-0 space-y-4">
          <slot />
        </div>
        <aside v-if="hasAside" class="min-w-0 space-y-4">
          <slot name="aside" />
        </aside>
      </section>
    </div>
  </main>
</template>
