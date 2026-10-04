<script setup lang="ts">
import { computed, useId } from "vue";
import { Ellipsis } from "lucide-vue-next";
import { useWorkbenchControllerContext } from "../runtime/workbenchController.js";
import { useMenuRuntime } from "../menu/useMenuRuntime.js";
import type { WorkbenchBreadcrumbItem } from "./breadcrumbTypes";

const props = withDefaults(defineProps<{
  items: readonly WorkbenchBreadcrumbItem[];
  /** 未指定时保持原来的完整路径与尾部分隔符。 */
  maxItems?: number;
  overflowLabel?: string;
}>(), { overflowLabel: "完整路径" });
const controller = useWorkbenchControllerContext();
const menuId = useId();
const limit = computed(() => props.maxItems === undefined ? props.items.length : Math.max(2, Math.floor(props.maxItems)));
const collapsed = computed(() => props.items.length > limit.value);
const hidden = computed(() => collapsed.value ? props.items.slice(1, props.items.length - limit.value + 1) : []);
const trailing = computed(() => collapsed.value ? props.items.slice(props.items.length - limit.value + 1) : props.items.slice(1));
function openAncestors(event: MouseEvent) {
  (controller?.menu ?? useMenuRuntime()).openMenu({
    id: menuId, source: "topbar", anchor: { element: event.currentTarget as HTMLElement },
    items: hidden.value.map((item, index) => ({ kind: "action", id: String(index), label: item.label, disabled: !item.href && !item.onSelect, onSelect: () => { if (item.onSelect) item.onSelect(); else if (item.href) window.location.assign(item.href); } }))
  });
}
</script>

<template>
  <nav v-if="items.length" class="flex min-w-0 items-center gap-1 text-small text-text-muted" aria-label="Breadcrumb">
    <template v-for="(item, index) in items.slice(0, 1)" :key="`${item.label}-${index}`">
      <button v-if="item.onSelect" type="button" class="shrink-0 hover:text-text-secondary" @click="item.onSelect()">{{ item.label }}</button>
      <a v-else-if="item.href" :href="item.href" class="shrink-0 hover:text-text-secondary">{{ item.label }}</a>
      <span v-else class="shrink-0 text-text-subtle">{{ item.label }}</span>
      <span class="shrink-0 text-text-subtle" aria-hidden="true">/</span>
    </template>
    <template v-if="collapsed">
      <button type="button" class="flex size-6 shrink-0 items-center justify-center rounded hover:bg-surface-hover" :title="overflowLabel" :aria-label="overflowLabel" aria-haspopup="menu" data-menu-trigger="true" @click="openAncestors"><Ellipsis class="size-4" aria-hidden="true" /></button>
      <span class="shrink-0 text-text-subtle" aria-hidden="true">/</span>
    </template>
    <template v-for="(item, index) in trailing" :key="`${item.label}-${index}`">
      <button v-if="item.onSelect" type="button" class="min-w-0 truncate hover:text-text-secondary" :title="item.label" @click="item.onSelect()">{{ item.label }}</button>
      <a v-else-if="item.href" :href="item.href" class="min-w-0 truncate hover:text-text-secondary" :title="item.label">{{ item.label }}</a>
      <span v-else class="min-w-0 truncate text-text-subtle" :title="item.label">{{ item.label }}</span>
      <span class="shrink-0 text-text-subtle" aria-hidden="true">/</span>
    </template>
  </nav>
</template>
