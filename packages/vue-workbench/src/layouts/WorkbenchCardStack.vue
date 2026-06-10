<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(defineProps<{
  maxWidth?: "3xl" | "4xl" | "5xl" | "6xl" | "full";
  gap?: "sm" | "md" | "lg";
}>(), {
  maxWidth: "5xl",
  gap: "md"
});

const stackClass = computed(() => {
  const maxWidthClass = {
    "3xl": "max-w-3xl",
    "4xl": "max-w-4xl",
    "5xl": "max-w-5xl",
    "6xl": "max-w-6xl",
    full: "max-w-none"
  }[props.maxWidth];

  const gapClass = {
    sm: "gap-3",
    md: "gap-4",
    lg: "gap-5"
  }[props.gap];

  return [
    "mx-auto flex w-full flex-col",
    maxWidthClass,
    gapClass
  ].join(" ");
});
</script>

<template>
  <div :class="stackClass">
    <slot />
  </div>
</template>
