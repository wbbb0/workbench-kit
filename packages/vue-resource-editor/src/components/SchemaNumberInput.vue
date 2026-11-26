<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { DURATION_SCALES, DURATION_UNITS } from "@workbench-kit/schema";
import type { SchemaMeta } from "../types";
const props = defineProps<{
  schema: SchemaMeta;
  inputId?: string;
  modelValue: unknown;
  defaultValue?: unknown;
  placeholder?: string;
  disabled?: boolean;
  preserveRawNumber?: boolean;
}>();
const emit = defineEmits<{ "update:modelValue": [value: unknown] }>();
const units = DURATION_UNITS;
const scales = DURATION_SCALES;
const duration = computed(() => props.schema.format === "duration");
const scale = ref(duration.value ? scales[props.schema.timescale ?? "ms"] : 1);
watch(
  () => [props.schema.format, props.schema.timescale] as const,
  () => {
    scale.value = duration.value ? scales[props.schema.timescale ?? "ms"] : 1;
  },
);
const display = computed(() =>
  typeof props.modelValue === "number"
    ? props.modelValue / scale.value
    : (props.modelValue ?? ""),
);
const hint = computed(() =>
  typeof props.defaultValue === "number"
    ? String(props.defaultValue / scale.value)
    : props.placeholder,
);
const step = computed(() =>
  props.schema.step !== undefined
    ? props.schema.step / scale.value
    : props.schema.integer && scale.value === 1
      ? 1
      : "any",
);
const bounded = computed(
  () =>
    !duration.value &&
    props.schema.control !== "number" &&
    Number.isFinite(props.schema.min) &&
    Number.isFinite(props.schema.max) &&
    props.schema.max! > props.schema.min!,
);
const rangeValue = computed(() => {
  const candidate = Number(
    props.modelValue === undefined || props.modelValue === ""
      ? props.defaultValue
      : props.modelValue,
  );
  return Number.isFinite(candidate) ? candidate : props.schema.min;
});
function input(event: Event) {
  const raw = (event.target as HTMLInputElement).value;
  if (!raw.trim()) {
    emit("update:modelValue", props.preserveRawNumber ? "" : null);
    return;
  }
  const parsed = Number(raw);
  if (duration.value && Number.isFinite(parsed))
    emit("update:modelValue", parsed * scale.value);
  else if (props.preserveRawNumber) emit("update:modelValue", raw);
  else emit("update:modelValue", Number.isFinite(parsed) ? parsed : null);
}
</script>
<template>
  <div class="flex min-w-0 flex-wrap items-center gap-2">
    <input
      v-if="bounded"
      type="range"
      class="min-w-20 flex-1 accent-accent"
      :aria-label="(schema.title || '数值') + '滑条'"
      :min="schema.min"
      :max="schema.max"
      :step="step"
      :value="rangeValue"
      :disabled="disabled"
      @input="
        emit(
          'update:modelValue',
          Number(($event.target as HTMLInputElement).value),
        )
      "
    />
    <input
      :id="inputId"
      :type="preserveRawNumber ? 'text' : 'number'"
      inputmode="decimal"
      class="input-base h-7 min-w-0 flex-1 px-1.5 py-0.5"
      :class="bounded || duration ? 'w-20' : 'w-32'"
      :value="display"
      :placeholder="hint"
      :min="schema.min === undefined ? undefined : schema.min / scale"
      :max="schema.max === undefined ? undefined : schema.max / scale"
      :step="step"
      :disabled="disabled"
      @input="input"
    />
    <select
      v-if="duration"
      v-model.number="scale"
      :aria-label="(schema.title || '时长') + '单位'"
      class="input-base h-7 shrink-0 px-1"
      :disabled="disabled"
    >
      <option v-for="unit in units" :key="unit.scale" :value="unit.scale">
        {{ unit.label }}
      </option>
    </select>
  </div>
</template>
