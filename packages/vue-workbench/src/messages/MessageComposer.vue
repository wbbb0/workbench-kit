<script setup lang="ts">
import { ref, onMounted, onActivated, nextTick } from "vue";
const props = defineProps<{
  modelValue: string;
  busy?: boolean;
  status?: string;
  compact?: boolean;
  selectionStart?: number;
  selectionEnd?: number;
}>();
const emit = defineEmits<{
  "update:modelValue": [text: string];
  submit: [];
  selection: [start: number, end: number];
}>();
const input = ref<HTMLTextAreaElement>();
function key(event: KeyboardEvent) {
  if (
    event.key === "Enter" &&
    !event.shiftKey &&
    !event.isComposing &&
    event.keyCode !== 229
  ) {
    event.preventDefault();
    if (!props.busy && props.modelValue.trim()) emit("submit");
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
    :class="compact ? 'px-3 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2' : 'px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3'"
    @submit.prevent="emit('submit')"
  >
    <div
      class="mx-auto max-w-4xl border border-border-default bg-surface-panel focus-within:border-accent"
      :class="compact ? 'p-2' : 'p-3'"
    >
      <textarea
        ref="input"
        :value="modelValue"
        :rows="compact ? 2 : 3"
        aria-label="消息草稿"
        placeholder="输入消息，Enter 发送，Shift+Enter 换行"
        class="block max-h-56 w-full resize-y border-0 bg-transparent text-sm leading-6 outline-none"
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
      <div class="flex items-center justify-between gap-3">
        <span v-if="status" class="text-xs text-text-muted" role="status">{{ status }}</span
        ><button
          class="ml-auto bg-accent text-xs font-semibold text-white disabled:opacity-40"
          :class="compact ? 'px-3 py-1' : 'px-4 py-2'"
          :disabled="busy || !modelValue.trim()"
          type="submit"
        >
          {{ busy ? "正在提交" : "发送" }}
        </button>
      </div>
    </div>
  </form>
</template>
