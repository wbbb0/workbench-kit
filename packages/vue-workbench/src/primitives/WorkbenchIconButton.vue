<script setup lang="ts">
import type { Component } from "vue";
import WorkbenchButton from "./WorkbenchButton.vue";

const props = withDefaults(defineProps<{
  icon?: Component;
  label?: string;
  title?: string;
  disabled?: boolean;
  active?: boolean;
  size?: "sm" | "md";
  variant?: "ghost" | "secondary";
  iconSize?: number;
  strokeWidth?: number;
  type?: "button" | "submit" | "reset";
}>(), {
  icon: undefined,
  label: "",
  title: "",
  disabled: false,
  active: false,
  size: "md",
  variant: "ghost",
  iconSize: 14,
  strokeWidth: 2,
  type: "button"
});

defineEmits<{
  click: [event: MouseEvent];
}>();
</script>

<template>
  <WorkbenchButton
    v-if="$slots.default"
    :label="props.label"
    :title="props.title"
    :disabled="props.disabled"
    :active="props.active"
    :variant="props.variant"
    :type="props.type"
    :class="[
      'workbench-icon-button',
      props.size === 'sm' ? 'h-7 w-7' : '',
      props.active ? 'bg-surface-selected-muted text-text-secondary' : ''
    ]"
    @click="$emit('click', $event)"
  >
    <slot />
  </WorkbenchButton>
  <WorkbenchButton
    v-else
    :icon="props.icon"
    :label="props.label"
    :title="props.title"
    :disabled="props.disabled"
    :active="props.active"
    :variant="props.variant"
    :icon-size="props.iconSize"
    :stroke-width="props.strokeWidth"
    :type="props.type"
    :class="[
      'workbench-icon-button',
      props.size === 'sm' ? 'h-7 w-7' : '',
      props.active ? 'bg-surface-selected-muted text-text-secondary' : ''
    ]"
    @click="$emit('click', $event)"
  />
</template>
