<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import WorkbenchButton from "../primitives/WorkbenchButton.vue";
import { formatWorkbenchError, type WorkbenchErrorInfo } from "./types.js";

const props = withDefaults(defineProps<{
  info: WorkbenchErrorInfo;
  showTitle?: boolean;
  retryError?: string;
}>(), { showTitle: true });

const copyText = computed(() => formatWorkbenchError(props.info));
const copying = ref(false);
const copied = ref(false);
const copyFallback = ref(false);
const selectableDetails = ref<HTMLTextAreaElement | null>(null);

async function copyDetails(): Promise<void> {
  if (copying.value) return;
  copying.value = true;
  copied.value = false;
  try {
    if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
    await navigator.clipboard.writeText(copyText.value);
    copyFallback.value = false;
    copied.value = true;
  } catch {
    copyFallback.value = true;
    await nextTick();
    selectableDetails.value?.focus();
    selectableDetails.value?.select();
  } finally {
    copying.value = false;
  }
}
</script>

<template>
  <div class="flex min-w-0 flex-col gap-3 text-small text-text-secondary">
    <h3 v-if="showTitle && info.title" class="break-words font-medium">{{ info.title }}</h3>
    <p role="alert" class="whitespace-pre-wrap break-words">{{ info.message }}</p>
    <p v-if="info.hint" class="whitespace-pre-wrap break-words text-text-muted">{{ info.hint }}</p>
    <dl v-if="info.code || info.requestId" class="grid min-w-0 gap-1 text-small text-text-subtle">
      <div v-if="info.code" class="flex flex-wrap gap-x-2"><dt>错误代码</dt><dd class="min-w-0 break-all font-mono select-text">{{ info.code }}</dd></div>
      <div v-if="info.requestId" class="flex flex-wrap gap-x-2"><dt>请求编号</dt><dd class="min-w-0 break-all font-mono select-text">{{ info.requestId }}</dd></div>
    </dl>
    <details v-if="info.details" class="min-w-0 text-text-muted">
      <summary class="cursor-pointer">技术详情</summary>
      <pre class="mt-2 whitespace-pre-wrap break-all font-mono text-small select-text">{{ info.details }}</pre>
    </details>
    <p v-if="retryError" role="alert" class="whitespace-pre-wrap break-words text-danger">重试未完成：{{ retryError }}</p>
    <div class="flex flex-wrap items-center gap-2">
      <WorkbenchButton label="复制详情" variant="secondary" :disabled="copying" @click="copyDetails" />
      <span v-if="copied" role="status" class="text-text-muted">已复制</span>
    </div>
    <template v-if="copyFallback">
      <p role="status" class="text-text-muted">无法访问剪贴板，请选择并复制以下内容。</p>
      <textarea ref="selectableDetails" class="input-base w-full resize-y select-text font-mono text-small" aria-label="可复制的错误详情" rows="6" readonly :value="copyText" />
    </template>
  </div>
</template>
