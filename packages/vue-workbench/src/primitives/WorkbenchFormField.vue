<script setup lang="ts">
withDefaults(defineProps<{
  label?: string;
  forId?: string;
  hint?: string;
  error?: string;
  required?: boolean;
}>(), {
  label: "",
  forId: "",
  hint: "",
  error: "",
  required: false
});
</script>

<template>
  <label class="flex min-w-0 flex-col gap-1.5 text-small text-text-secondary" :for="forId || undefined">
    <span v-if="label || $slots.label" class="flex items-baseline gap-1 font-medium text-text-secondary">
      <slot name="label">{{ label }}</slot>
      <span v-if="required" class="text-danger" aria-hidden="true">*</span>
    </span>
    <slot />
    <span v-if="error" class="text-small text-danger">{{ error }}</span>
    <span v-else-if="hint" class="text-small text-text-subtle">{{ hint }}</span>
  </label>
</template>

