<script setup lang="ts">
import {
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  ref,
  watch,
} from "vue";
import { VList, type VListHandle } from "virtua/vue";
import { useMessageViewport } from "./useMessageViewport";
import WorkbenchButton from "../primitives/WorkbenchButton.vue";
import MessageContent from "./MessageContent.vue";
import type { MessageItem, ReadingAnchor } from "./types";
const props = withDefaults(
  defineProps<{
    items: MessageItem[];
    anchor?: ReadingAnchor;
    older?: boolean;
    newer?: boolean;
    unseen?: number;
    loading?: boolean;
    active?: boolean;
    compact?: boolean;
  }>(),
  { active: true },
);
const emit = defineEmits<{
  older: [];
  newer: [];
  anchor: [anchor: ReadingAnchor];
  reference: [id: string];
  detail: [id: string];
  latest: [];
  action: [itemId: string, actionId: string];
}>();
const list = ref<VListHandle>();
const root = ref<HTMLElement>();
const unread = ref(0);
let enabled = true;
let observer: ResizeObserver | undefined;
let mutation: MutationObserver | undefined;
let frame: number | undefined;
const sizes = new WeakMap<Element, number>();
const { following, previousAnchor, restoring, capture, restore } =
  useMessageViewport(
    list,
    () => props.items,
    () => enabled && props.active !== false,
    (anchor) => emit("anchor", anchor),
  );
function openItem(event: MouseEvent, item: MessageItem) {
  const target = event.target as HTMLElement;
  if (
    target.closest(
      "a, button, input, textarea, select, summary, [contenteditable]",
    )
  )
    return;
  if (window.getSelection()?.toString()) return;
  emit("detail", item.id);
}
function scroll() {
  if (!enabled || props.active === false || restoring.value) return;
  capture();
  const v = list.value;
  if (v && v.scrollOffset < 180 && props.older && !props.loading) emit("older");
  if (
    v &&
    v.scrollSize - v.viewportSize - v.scrollOffset < 180 &&
    props.newer &&
    !props.loading
  )
    emit("newer");
  if (following.value) unread.value = 0;
}
function latest() {
  unread.value = 0;
  following.value = true;
  emit("latest");
  void restore();
}
watch(
  () => props.items,
  (rows, old) => {
    if (!enabled || props.active === false) return;
    const oldLast = old?.at(-1);
    const lastIndex = oldLast
      ? rows.findIndex((row) => row.id === oldLast.id)
      : -1;
    const added =
      lastIndex >= 0
        ? rows
            .slice(lastIndex + 1)
            .filter((row) => !old?.some((previous) => previous.id === row.id))
        : [];
    const prepended =
      !!old?.length &&
      rows.some((row) => row.id === old[0]?.id) &&
      rows[0]?.id !== old[0]?.id;
    if (following.value || prepended)
      void restore(previousAnchor.value ?? props.anchor);
    else unread.value += added.length;
  },
  { flush: "pre" },
);
watch(
  () => props.anchor?.id,
  () => {
    if (props.anchor && props.anchor.id !== previousAnchor.value?.id)
      void restore(props.anchor);
  },
);
function observeRows() {
  if (!enabled || !observer || !root.value) return;
  observer.observe(root.value);
  for (const row of root.value.querySelectorAll("[data-row-id]"))
    observer.observe(row);
}
function resize(entries: ResizeObserverEntry[]) {
  if (!enabled || props.active === false) return;
  let changed = false;
  for (const entry of entries) {
    const height = entry.contentRect.height;
    const previous = sizes.get(entry.target);
    sizes.set(entry.target, height);
    if (previous !== undefined && previous !== height) changed = true;
  }
  if (!changed) return;
  if (frame !== undefined) cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    frame = undefined;
    void restore(
      following.value ? undefined : (previousAnchor.value ?? props.anchor),
    );
  });
}
onMounted(() => {
  observer = new ResizeObserver(resize);
  mutation = new MutationObserver(observeRows);
  if (root.value)
    mutation.observe(root.value, { childList: true, subtree: true });
  observeRows();
  void restore(props.anchor);
});
onActivated(() => {
  enabled = true;
  observeRows();
  void restore(props.anchor ?? previousAnchor.value);
});
onDeactivated(() => {
  capture();
  enabled = false;
  observer?.disconnect();
  if (frame !== undefined) cancelAnimationFrame(frame);
});
onBeforeUnmount(() => {
  observer?.disconnect();
  mutation?.disconnect();
  if (frame !== undefined) cancelAnimationFrame(frame);
});

defineExpose({ capture, restore });
</script>
<template>
  <div ref="root" class="relative min-h-0 flex-1">
    <VList
      ref="list"
      :data="items"
      :item-props="({ item }: { item: MessageItem }) => ({ key: item.id })"
      class="h-full overflow-y-auto"
      @scroll="scroll"
      ><template #default="{ item }"
        ><article
          :data-row-id="item.id"
          @click="openItem($event, item)"
          class="mx-auto w-full max-w-4xl border-b border-border-default"
          :class="[compact ? 'px-3 py-3' : 'px-5 py-5', item.author === '你' ? 'bg-surface-panel/40' : '']"
        >
          <header class="mb-2 flex items-center gap-2 text-xs text-text-muted">
            <button
              class="font-medium text-text-secondary"
              :aria-label="
                item.kind === 'message'
                  ? '查看消息详情'
                  : item.kind === 'turn'
                    ? '查看处理过程详情'
                    : item.kind === 'tool_call'
                      ? '查看工具执行详情'
                      : item.kind === 'model_call'
                        ? '查看模型请求详情'
                        : '查看记录详情'
              "
              @click="emit('detail', item.id)"
            >
              {{ item.author || item.kind }}
            </button>
          </header>
          <MessageContent :parts="item.parts" :class="{ 'text-danger': item.tone === 'danger', 'text-warning': item.tone === 'warning', 'text-success': item.tone === 'success' }" />
          <div v-if="item.actions?.length" class="mt-2 flex flex-wrap gap-2">
            <WorkbenchButton v-for="action in item.actions" :key="action.id" :label="action.label" variant="secondary" :disabled="action.disabled" @click="emit('action', item.id, action.id)" />
          </div></article></template></VList
    ><button
      v-if="unread || unseen || newer"
      class="absolute bottom-4 right-5 border border-border-default bg-surface-panel px-4 py-2 text-xs"
      @click="latest"
    >
      {{
        unread || unseen ? `${unread + (unseen ?? 0)} 条新消息 · ` : ""
      }}回到最新 ↓</button
    ><span
      v-if="loading"
      class="absolute left-1/2 top-2 bg-surface-panel px-3 py-1 text-xs text-text-muted"
      >正在加载</span
    >
  </div>
</template>
