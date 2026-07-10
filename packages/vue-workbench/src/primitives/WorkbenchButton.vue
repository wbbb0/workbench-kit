<script setup lang="ts">
import { computed, useAttrs, type Component, type CSSProperties } from "vue";
import type { WorkbenchButtonColors, WorkbenchButtonVariant } from "./buttonTypes.js";

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<{
  icon?: Component;
  label?: string;
  title?: string;
  disabled?: boolean;
  active?: boolean;
  variant?: WorkbenchButtonVariant;
  iconPosition?: "start" | "end";
  iconSize?: number;
  strokeWidth?: number;
  type?: "button" | "submit" | "reset";
  colors?: WorkbenchButtonColors;
}>(), {
  icon: undefined,
  label: "",
  title: "",
  disabled: false,
  active: false,
  variant: "secondary",
  iconPosition: "start",
  iconSize: 16,
  strokeWidth: 2,
  type: "button",
  colors: undefined
});

const emit = defineEmits<{
  click: [event: MouseEvent];
}>();

const attrs = useAttrs();

const forwardedAttrs = computed(() => {
  const { class: _class, style: _style, ...rest } = attrs;
  return rest;
});

const accessibleLabel = computed(() => (
  props.label || props.title || (typeof attrs["aria-label"] === "string" ? attrs["aria-label"] : undefined)
));

const colorStyle = computed<CSSProperties>(() => {
  const colors = props.colors;
  if (!colors) {
    return {};
  }

  return {
    "--workbench-button-text": colors.text,
    "--workbench-button-background": colors.background,
    "--workbench-button-border": colors.border,
    "--workbench-button-hover-text": colors.hoverText,
    "--workbench-button-hover-background": colors.hoverBackground,
    "--workbench-button-hover-border": colors.hoverBorder,
    "--workbench-button-active-text": colors.activeText,
    "--workbench-button-active-background": colors.activeBackground,
    "--workbench-button-active-border": colors.activeBorder,
    "--workbench-button-disabled-text": colors.disabledText,
    "--workbench-button-disabled-background": colors.disabledBackground,
    "--workbench-button-disabled-border": colors.disabledBorder
  } as CSSProperties;
});
</script>

<template>
  <button
    v-bind="forwardedAttrs"
    :type="type"
    :title="title || label || undefined"
    :aria-label="accessibleLabel"
    :aria-pressed="active || undefined"
    :disabled="disabled"
    :class="[
      'workbench-button btn',
      `btn-${variant}`,
      `workbench-button-${iconPosition}`,
      { 'is-active': active },
      attrs.class
    ]"
    :style="[attrs.style, colorStyle]"
    @click="emit('click', $event)"
  >
    <component
      v-if="icon && iconPosition === 'start'"
      :is="icon"
      :size="iconSize"
      :stroke-width="strokeWidth"
      aria-hidden="true"
    />
    <span v-if="label">{{ label }}</span>
    <slot />
    <component
      v-if="icon && iconPosition === 'end'"
      :is="icon"
      :size="iconSize"
      :stroke-width="strokeWidth"
      aria-hidden="true"
    />
  </button>
</template>
