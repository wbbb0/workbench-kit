<script setup lang="ts" generic="TItem">
import { nextTick, onActivated, onDeactivated, ref, type Component } from "vue";
import WorkbenchAreaHeader from "./WorkbenchAreaHeader.vue";
import WorkbenchEmptyState from "./WorkbenchEmptyState.vue";
import WorkbenchListItem from "./WorkbenchListItem.vue";
import type { WorkbenchSidebarListItem } from "./sidebarListTypes.js";

withDefaults(defineProps<{
  title?: string;
  ariaLabel?: string;
  role?: "navigation" | "region" | "list";
  items?: readonly TItem[];
  loading?: boolean;
  emptyMessage?: string;
  showHeader?: boolean;
  divided?: boolean;
  dense?: boolean;
  multiline?: boolean;
  navigate?: boolean;
  itemKey?: (item: TItem, index: number) => string | number;
}>(), {
  title: "",
  ariaLabel: undefined,
  role: undefined,
  items: undefined,
  loading: false,
  emptyMessage: "暂无数据",
  showHeader: true,
  divided: true,
  dense: false,
  multiline: false,
  navigate: true,
  itemKey: undefined,
});

const emit = defineEmits<{
  select: [item: TItem, index: number];
}>();

const scrollElement = ref<HTMLElement>();
let savedScrollTop = 0;

onDeactivated(() => {
  savedScrollTop = scrollElement.value?.scrollTop ?? 0;
});

onActivated(() => {
  if (savedScrollTop <= 0) {
    return;
  }
  void nextTick(() => {
    if (scrollElement.value) {
      scrollElement.value.scrollTop = savedScrollTop;
    }
  });
});

defineExpose({ scrollElement });

function asRecord(item: TItem): Record<string, unknown> | undefined {
  return typeof item === "object" && item !== null
    ? (item as Record<string, unknown>)
    : undefined;
}

function getItemKey(item: TItem, index: number): string | number {
  const record = asRecord(item);
  if (record && (typeof record.id === "string" || typeof record.id === "number")) {
    return record.id;
  }
  return index;
}

function resolveTitle(item: TItem): string {
  const record = asRecord(item);
  if (!record) return String(item);
  if (typeof record.title === "string") return record.title;
  if (typeof record.name === "string") return record.name;
  return String(record.id ?? "");
}

function resolveSubtitle(item: TItem): string | null {
  const record = asRecord(item);
  return record && typeof record.subtitle === "string" ? record.subtitle : null;
}

function resolveMeta(item: TItem): string | number | null {
  const record = asRecord(item);
  if (!record) return null;
  return typeof record.meta === "string" || typeof record.meta === "number"
    ? record.meta
    : null;
}

function resolveBoolean(item: TItem, key: string, fallback: boolean): boolean {
  const record = asRecord(item);
  return record && typeof record[key] === "boolean" ? record[key] : fallback;
}

function resolveIcon(item: TItem): Component | undefined {
  const record = asRecord(item);
  return record?.icon as Component | undefined;
}

function resolveString(item: TItem, key: string): string | undefined {
  const record = asRecord(item);
  return record && typeof record[key] === "string" ? record[key] : undefined;
}

function resolveAriaCurrent(item: TItem): WorkbenchSidebarListItem["ariaCurrent"] {
  const record = asRecord(item);
  if (!record) return undefined;
  const value = record.ariaCurrent;
  if (typeof value === "boolean") return value;
  if (
    value === "page" ||
    value === "step" ||
    value === "location" ||
    value === "date" ||
    value === "time" ||
    value === "true"
  ) {
    return value;
  }
  return undefined;
}

function resolveAttrs(item: TItem): Record<string, unknown> | undefined {
  const record = asRecord(item);
  if (
    !record ||
    typeof record.attrs !== "object" ||
    record.attrs === null ||
    Array.isArray(record.attrs)
  ) {
    return undefined;
  }
  return record.attrs as Record<string, unknown>;
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col overflow-hidden">
    <WorkbenchAreaHeader v-if="showHeader" :title="title">
      <slot name="header" />
      <template v-if="$slots.actions" #actions>
        <slot name="actions" />
      </template>
    </WorkbenchAreaHeader>
    <div
      ref="scrollElement"
      class="min-h-0 flex-1 overflow-y-auto"
      :role="role ?? (ariaLabel ? 'region' : undefined)"
      :aria-label="ariaLabel || undefined"
    >
      <slot name="before-list" />
      <template v-if="items !== undefined">
        <template
          v-for="(item, index) in items"
          :key="itemKey ? itemKey(item, index) : getItemKey(item, index)"
        >
          <slot
            name="item"
            :item="item"
            :index="index"
            :dense="dense"
            :divided="divided"
            :multiline="multiline"
          >
            <WorkbenchListItem
              v-bind="resolveAttrs(item)"
              :title="resolveTitle(item)"
              :subtitle="resolveSubtitle(item)"
              :meta="resolveMeta(item)"
              :selected="resolveBoolean(item, 'selected', false)"
              :disabled="resolveBoolean(item, 'disabled', false)"
              :icon="resolveIcon(item)"
              :icon-class="resolveString(item, 'iconClass')"
              :disclosure="resolveBoolean(item, 'disclosure', false)"
              :aria-current="resolveAriaCurrent(item)"
              :dense="resolveBoolean(item, 'dense', dense)"
              :multiline="resolveBoolean(item, 'multiline', multiline)"
              :divided="resolveBoolean(item, 'divided', divided)"
              :navigate="resolveBoolean(item, 'navigate', navigate)"
              @select="emit('select', item, index)"
            />
          </slot>
        </template>
        <WorkbenchEmptyState
          v-if="items.length === 0 && !loading && emptyMessage"
          :centered="false"
          class="justify-center px-3 py-6 text-center text-small text-text-subtle"
          :message="emptyMessage"
        />
      </template>
      <slot name="after-list" />
      <slot />
    </div>
  </div>
</template>
