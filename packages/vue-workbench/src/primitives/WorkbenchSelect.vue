<script setup lang="ts">
defineOptions({
  inheritAttrs: false
});

type WorkbenchSelectOption =
  | string
  | {
      value: string;
      label?: string;
      disabled?: boolean;
    };

const props = withDefaults(defineProps<{
  modelValue?: string;
  options: readonly WorkbenchSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
}>(), {
  modelValue: "",
  placeholder: "",
  disabled: false,
  required: false,
  name: undefined
});

defineEmits<{
  "update:modelValue": [value: string];
}>();

function optionValue(option: WorkbenchSelectOption) {
  return typeof option === "string" ? option : option.value;
}

function optionLabel(option: WorkbenchSelectOption) {
  return typeof option === "string" ? option : option.label ?? option.value;
}

function optionDisabled(option: WorkbenchSelectOption) {
  return typeof option === "string" ? false : option.disabled === true;
}
</script>

<template>
  <select
    v-bind="$attrs"
    class="input-base min-h-8"
    :disabled="disabled"
    :name="name"
    :required="required"
    :value="modelValue"
    @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
  >
    <option v-if="placeholder" value="" :disabled="required">{{ placeholder }}</option>
    <option
      v-for="option in props.options"
      :key="optionValue(option)"
      :disabled="optionDisabled(option)"
      :value="optionValue(option)"
    >
      {{ optionLabel(option) }}
    </option>
  </select>
</template>

