<script setup lang="ts">
withDefaults(defineProps<{
  orientation: "vertical" | "horizontal";
  active?: boolean;
  label: string;
  valueNow: number;
  valueMin: number;
  valueMax: number;
  valueText?: string;
}>(), {
  active: false
});

const emit = defineEmits<{
  pointerdown: [event: PointerEvent];
  dblclick: [event: MouseEvent];
  keydown: [event: KeyboardEvent];
}>();
</script>

<template>
  <div
    class="workbench-sash focus:outline-none"
    :class="[
      orientation === 'vertical' ? 'workbench-sash-vertical' : 'workbench-sash-horizontal',
      active ? 'active' : ''
    ]"
    role="separator"
    :aria-label="label"
    :aria-orientation="orientation"
    :aria-valuenow="valueNow"
    :aria-valuemin="valueMin"
    :aria-valuemax="valueMax"
    :aria-valuetext="valueText"
    tabindex="0"
    @pointerdown="emit('pointerdown', $event)"
    @dblclick="emit('dblclick', $event)"
    @keydown="emit('keydown', $event)"
  />
</template>
