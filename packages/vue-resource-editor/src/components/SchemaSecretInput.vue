<script setup lang="ts">
import { computed } from "vue";
import { WorkbenchButton } from "@workbench-kit/vue-workbench";

const props = defineProps<{
  inputId?: string;
  /** 脱敏协议模式：输入框仅保留未提交缓冲，通过 commit/clear 提交给宿主。 */
  redacted?: boolean;
  isSet?: boolean;
  draftValue?: string;
  modelValue?: unknown;
  disabled?: boolean;
  readOnly?: boolean;
}>();

const emit = defineEmits<{
  "update:draftValue": [value: string];
  "update:modelValue": [value: unknown];
  commit: [value: string | undefined];
  clear: [];
}>();

const hasValue = computed(() =>
  props.redacted
    ? !!props.isSet
    : typeof props.modelValue === "string" && props.modelValue.length > 0,
);
</script>

<template>
  <span
    v-if="readOnly"
    class="font-mono text-mono leading-5"
    :class="hasValue ? 'text-text-primary' : 'text-text-subtle'"
    >{{ hasValue ? "已设置" : "未设置" }}</span
  >
  <div v-else-if="redacted" class="flex flex-wrap items-center gap-2">
    <input
      :id="inputId"
      type="text"
      autocomplete="off"
      autocapitalize="off"
      :spellcheck="false"
      :placeholder="isSet ? '已设置，输入以替换' : '未设置'"
      class="input-base min-w-0 flex-1 px-2 py-1 [-webkit-text-security:disc]"
      :value="draftValue ?? ''"
      :disabled="disabled"
      @input="
        emit('update:draftValue', ($event.target as HTMLInputElement).value)
      "
    />
    <WorkbenchButton
      label="替换"
      size="sm"
      :disabled="disabled || draftValue === undefined"
      @click="emit('commit', draftValue)"
    />
    <WorkbenchButton
      label="清除"
      size="sm"
      variant="danger"
      :disabled="disabled"
      @click="emit('clear')"
    />
  </div>
  <div v-else class="flex flex-wrap items-center gap-2">
    <input
      :id="inputId"
      type="text"
      autocomplete="off"
      autocapitalize="off"
      :spellcheck="false"
      :placeholder="hasValue ? '已设置' : '未设置'"
      class="input-base min-w-0 flex-1 px-2 py-1 [-webkit-text-security:disc]"
      :value="typeof modelValue === 'string' ? modelValue : ''"
      :disabled="disabled"
      @input="
        emit('update:modelValue', ($event.target as HTMLInputElement).value)
      "
    />
    <WorkbenchButton
      v-if="hasValue && !disabled"
      label="清除"
      size="sm"
      variant="danger"
      @click="emit('update:modelValue', undefined)"
    />
  </div>
</template>
