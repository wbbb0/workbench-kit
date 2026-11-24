<script setup lang="ts">
import {
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  ref,
  reactive,
  watch,
} from "vue";
import { Virtualizer, type VirtualizerHandle } from "virtua/vue";
import { useMessageViewport } from "./useMessageViewport";
import WorkbenchButton from "../primitives/WorkbenchButton.vue";
import MessageRecordHeader from "./MessageRecordHeader.vue";
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
    expandedRecords?: Map<string, boolean>;
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
const list = ref<VirtualizerHandle & { $el: HTMLElement }>();
const viewport = ref<HTMLElement>();
const unread = ref(0);
let enabled = true;
let observer: ResizeObserver | undefined;
let frame: number | undefined;
const { following, previousAnchor, restoring, capture, restore } =
  useMessageViewport(
    list,
    () => props.items,
    () => enabled && props.active !== false,
    (anchor) => emit("anchor", anchor),
  );
const expandedRecords = reactive(new Map<string, boolean>());
const expansion = () => props.expandedRecords ?? expandedRecords;
const foldable = (item: MessageItem) => !!(item.heading || item.activity);
const expanded = (item: MessageItem) =>
  expansion().get(item.id) ?? !!item.heading;
function toggle(item: MessageItem) {
  capture();
  // 折叠操作只改变阅读意图；行高与位置校正由虚拟列表统一负责。
  following.value = false;
  if (previousAnchor.value) {
    previousAnchor.value = { ...previousAnchor.value, bottom: false };
    emit("anchor", previousAnchor.value);
  }
  expansion().set(item.id, !expanded(item));
}
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
  if (frame !== undefined) {
    cancelAnimationFrame(frame);
    frame = undefined;
  }
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
function observeViewport() {
  if (!enabled || !observer) return;
  if (viewport.value) observer.observe(viewport.value);
  if (list.value) observer.observe(list.value.$el);
}
function followResize() {
  // 仅跟随视口/总内容的尺寸；不观察行、不在自由阅读时恢复锚点。
  if (!enabled || props.active === false || !following.value) return;
  if (frame !== undefined) cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    frame = undefined;
    if (following.value) void restore();
  });
}
onMounted(() => {
  observer = new ResizeObserver(followResize);
  observeViewport();
  void restore(props.anchor);
});
onActivated(() => {
  enabled = true;
  observeViewport();
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
  if (frame !== undefined) cancelAnimationFrame(frame);
});

defineExpose({ capture, restore });
</script>
<template>
  <div class="relative min-h-0 flex-1">
    <div ref="viewport" class="h-full overflow-y-auto">
      <Virtualizer
        ref="list"
        :data="items"
        :scroll-ref="viewport"
        @scroll="scroll"
        ><template #default="{ item }"
          ><article
            :key="item.id"
            :data-row-id="item.id"
            @click="openItem($event, item)"
            class="mx-auto w-full max-w-4xl border-b border-border-default"
            :class="[
              foldable(item) ? 'p-0' : compact ? 'px-3 py-3' : 'px-5 py-5',
              item.identity?.tone === 'accent' ? 'bg-surface-panel/40' : '',
              item.identity && !foldable(item) ? 'flex items-start gap-3' : '',
            ]"
          >
            <button
              v-if="item.identity && !foldable(item)"
              class="flex size-6 shrink-0 items-center justify-center rounded"
              :class="
                item.identity.tone === 'accent'
                  ? 'bg-accent text-white'
                  : 'bg-surface-muted text-text-muted'
              "
              :title="item.author || item.kind"
              :aria-label="item.detailLabel ?? (item.author || item.kind) + '：查看详情'"
              @click="emit('detail', item.id)"
            >
              <component
                :is="item.identity.icon"
                :size="15"
                aria-hidden="true"
              />
            </button>
            <MessageRecordHeader
              v-if="foldable(item)"
              :label="item.heading || item.activity!.label"
              :detail-label="item.detailLabel"
              :icon="item.identity?.icon"
              :state="item.state?.label"
              :danger="item.tone === 'danger'"
              :expanded="expanded(item)"
              @toggle="toggle(item)"
              @detail="emit('detail', item.id)"
            />
            <div
              v-if="!foldable(item) || expanded(item)"
              class="min-w-0 flex-1"
              :class="foldable(item) ? 'px-3 py-2' : ''"
            >
              <header
                v-if="!item.identity && !foldable(item)"
                class="mb-2 flex items-center gap-2 text-xs text-text-muted"
              >
                <button
                  class="font-medium text-text-secondary"
                  :aria-label="item.detailLabel ?? '查看记录详情'"
                  @click="emit('detail', item.id)"
                >
                  {{ item.author || item.kind }}
                </button>
              </header>
              <slot name="content" :item="item" :compact="compact">
                <MessageContent
                  :compact="compact"
                  :parts="item.parts"
                  @reference="emit('reference', $event)"
                  :class="{
                    'text-danger': item.tone === 'danger',
                    'text-warning': item.tone === 'warning',
                    'text-success': item.tone === 'success',
                  }"
                />
              </slot>
              <p
                v-if="item.state && !foldable(item)"
                class="mt-1 text-xs"
                :class="item.state.tone === 'danger' ? 'text-danger' : item.state.tone === 'warning' ? 'text-warning' : 'text-text-muted'"
              >{{ item.state.label }}</p>
              <footer
                v-if="item.metrics?.length"
                class="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] leading-4 text-text-muted"
                aria-label="性能统计"
              >
                <span
                  v-for="metric in item.metrics"
                  :key="metric.label"
                  :title="metric.title"
                  >{{ metric.label }} {{ metric.value }}</span
                >
              </footer>
              <div
                v-if="item.actions?.length"
                class="mt-2 flex flex-wrap gap-2"
              >
                <WorkbenchButton
                  v-for="action in item.actions"
                  :key="action.id"
                  :label="action.label"
                  variant="secondary"
                  :disabled="action.disabled"
                  @click="emit('action', item.id, action.id)"
                />
              </div>
            </div></article></template
      ></Virtualizer>
    </div>
    <button
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
