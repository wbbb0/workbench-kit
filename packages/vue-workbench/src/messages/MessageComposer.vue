<script setup lang="ts">
import { ref, onMounted, onActivated, nextTick } from "vue";
import { Paperclip, Send } from "lucide-vue-next";
import WorkbenchButton from "../primitives/WorkbenchButton.vue";
import WorkbenchIconButton from "../primitives/WorkbenchIconButton.vue";
const props = defineProps<{
  modelValue: string;
  busy?: boolean;
  status?: string;
  compact?: boolean;
  /** 嵌入页面底部时去掉外层留白与内部边框，保留居中宽度。 */
  flush?: boolean;
  layout?: "stacked" | "inline";
  attachmentButton?: boolean;
  hasAttachments?: boolean;
  attachmentDisabled?: boolean;
  inputLabel?: string;
  placeholder?: string;
  submitLabel?: string;
  showSubmitLabel?: boolean;
  selectionStart?: number;
  selectionEnd?: number;
}>();
const emit = defineEmits<{
  "update:modelValue": [text: string];
  submit: [];
  attachment: [event: MouseEvent];
  selection: [start: number, end: number];
}>();
const input = ref<HTMLTextAreaElement>();
function submit() {
  if (!props.busy && (props.modelValue.trim() || props.hasAttachments)) emit("submit");
}
function key(event: KeyboardEvent) {
  if (
    event.key === "Enter" &&
    !event.shiftKey &&
    !event.isComposing &&
    event.keyCode !== 229
  ) {
    event.preventDefault();
    submit();
  }
}
function selection() {
  if (input.value)
    emit("selection", input.value.selectionStart, input.value.selectionEnd);
}
function restore() {
  input.value?.setSelectionRange(
    props.selectionStart ?? props.modelValue.length,
    props.selectionEnd ?? props.modelValue.length,
  );
}
onMounted(() => {
  void nextTick(restore);
});
onActivated(() => {
  void nextTick(restore);
});
</script>
<template>
  <form
    class="shrink-0 border-t border-border-default bg-surface-app"
    :class="
      flush
        ? undefined
        : compact
          ? 'px-3 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2'
          : 'px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3'
    "
    @submit.prevent="submit"
  >
    <div
      class="mx-auto max-w-4xl bg-surface-panel"
      :class="[
        !flush ? 'border border-border-default focus-within:border-accent' : '',
        compact ? 'p-2' : 'p-3',
        layout === 'inline' ? 'flex items-end gap-2' : '',
      ]"
    >
      <WorkbenchIconButton
        v-if="attachmentButton"
        :icon="Paperclip"
        title="添加附件"
        size="sm"
        variant="secondary"
        data-menu-trigger="true"
        :disabled="attachmentDisabled"
        @click="emit('attachment', $event)"
      />
      <textarea
        ref="input"
        :value="modelValue"
        :rows="compact ? 2 : 3"
        :aria-label="inputLabel || '消息草稿'"
        :placeholder="placeholder || '输入消息，Enter 发送，Shift+Enter 换行'"
        class="block min-w-0 flex-1 max-h-56 w-full resize-y border-0 bg-transparent text-sm leading-6 outline-none"
        @input="
          emit(
            'update:modelValue',
            ($event.target as HTMLTextAreaElement).value,
          )
        "
        @keydown="key"
        @select="selection"
        @keyup="selection"
        @click="selection"
      />
      <slot v-if="layout === 'inline'" name="secondaryActions" />
      <WorkbenchButton
        v-if="layout === 'inline'"
        :icon="Send"
        :title="busy ? '正在提交' : submitLabel || '发送'"
        :label="showSubmitLabel ? submitLabel : undefined"
        size="sm"
        variant="primary"
        type="submit"
        :disabled="busy || (!modelValue.trim() && !hasAttachments)"
      />
      <div v-else class="flex items-center justify-between gap-3">
        <span v-if="status" class="text-xs text-text-muted" role="status">{{
          status
        }}</span
        ><button
          class="ml-auto bg-accent text-xs font-semibold text-text-on-accent disabled:opacity-40"
          :class="compact ? 'px-3 py-1' : 'px-4 py-2'"
          :disabled="busy || (!modelValue.trim() && !hasAttachments)"
          type="submit"
        >
          {{ busy ? "正在提交" : "发送" }}
        </button>
      </div>
    </div>
    <p
      v-if="layout === 'inline' && status"
      role="status"
      class="mx-auto mt-1 max-w-4xl text-xs text-text-muted"
    >
      {{ status }}
    </p>
  </form>
</template>
