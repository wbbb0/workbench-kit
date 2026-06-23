<script setup lang="ts">
defineOptions({
  inheritAttrs: false
});

withDefaults(defineProps<{
  modelValue?: string;
  type?: string;
  placeholder?: string;
  autocomplete?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
}>(), {
  modelValue: "",
  type: "text",
  placeholder: "",
  autocomplete: undefined,
  disabled: false,
  required: false,
  name: undefined
});

defineEmits<{
  "update:modelValue": [value: string];
}>();
</script>

<template>
  <input
    v-bind="$attrs"
    class="input-base min-h-8"
    :autocomplete="autocomplete"
    :disabled="disabled"
    :name="name"
    :placeholder="placeholder"
    :required="required"
    :type="type"
    :value="modelValue"
    @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
  />
</template>

