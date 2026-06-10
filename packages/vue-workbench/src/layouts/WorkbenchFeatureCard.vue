<script setup lang="ts">
import type { Component } from "vue";
import { computed } from "vue";
import WorkbenchCard from "../primitives/WorkbenchCard.vue";

const props = withDefaults(defineProps<{
  title?: string;
  subtitle?: string;
  icon?: Component | null;
  surface?: "panel" | "sidebar" | "input" | "muted";
  padding?: "none" | "sm" | "md" | "lg";
  bodyClass?: string;
}>(), {
  title: "",
  subtitle: "",
  icon: null,
  surface: "panel",
  padding: "lg",
  bodyClass: ""
});

const hasHeader = computed(() => Boolean(
  props.title || props.subtitle || props.icon
));
</script>

<template>
  <WorkbenchCard :surface="surface" :padding="padding">
    <div
      v-if="hasHeader || $slots.actions || $slots.icon"
      class="mb-4 flex items-start justify-between gap-3"
    >
      <div class="flex min-w-0 items-start gap-3">
        <div
          v-if="icon || $slots.icon"
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-text-secondary"
        >
          <slot name="icon">
            <component :is="icon" class="size-5" aria-hidden="true" />
          </slot>
        </div>
        <div class="min-w-0">
          <h2 v-if="title" class="text-ui font-medium text-text-primary">{{ title }}</h2>
          <p v-if="subtitle" class="mt-1 text-small text-text-muted">{{ subtitle }}</p>
        </div>
      </div>

      <div v-if="$slots.actions" class="flex shrink-0 items-center gap-2">
        <slot name="actions" />
      </div>
    </div>

    <div :class="bodyClass">
      <slot />
    </div>
  </WorkbenchCard>
</template>
