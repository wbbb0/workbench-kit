<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId, watch } from "vue";
import { Ellipsis } from "lucide-vue-next";
import { useWorkbenchControllerContext } from "../runtime/workbenchController.js";
import { useMenuRuntime } from "../menu/useMenuRuntime.js";
import type { WorkbenchBreadcrumbItem } from "./breadcrumbTypes";

const props = withDefaults(defineProps<{
  items: readonly WorkbenchBreadcrumbItem[];
  /** 未指定时保持原来的完整路径与尾部分隔符。 */
  maxItems?: number;
  /** 根据实际可用宽度折叠中间路径；maxItems 仍作为显式上限。 */
  autoCollapse?: boolean;
  overflowLabel?: string;
}>(), { overflowLabel: "完整路径" });
const controller = useWorkbenchControllerContext();
const menuId = useId();
const root = ref<HTMLElement>();
const measuring = ref<HTMLElement>();
const measuredLimit = ref<number>();
const explicitLimit = computed(() => props.maxItems === undefined ? props.items.length : Math.max(2, Math.floor(props.maxItems)));
const limit = computed(() => props.autoCollapse && measuredLimit.value !== undefined ? Math.min(explicitLimit.value, measuredLimit.value) : explicitLimit.value);
const collapsed = computed(() => props.items.length > limit.value);
const hidden = computed(() => collapsed.value ? props.items.slice(1, props.items.length - limit.value + 1) : []);
const trailing = computed(() => collapsed.value ? props.items.slice(props.items.length - limit.value + 1) : props.items.slice(1));
let observer: ResizeObserver | undefined;
let mounted = false;
function measure() {
  if (!props.autoCollapse || !root.value || !measuring.value) return;
  const style = getComputedStyle(root.value);
  const available = root.value.getBoundingClientRect().width - [style.paddingLeft, style.paddingRight, style.borderLeftWidth, style.borderRightWidth].reduce((sum, value) => sum + (parseFloat(value) || 0), 0);
  if (available <= 0) return;
  const widths = Array.from(measuring.value.querySelectorAll<HTMLElement>("[data-breadcrumb-measure-item]")).map(element => element.getBoundingClientRect().width);
  const overflowWidth = measuring.value.querySelector<HTMLElement>("[data-breadcrumb-measure-overflow]")?.getBoundingClientRect().width ?? 0;
  const gap = parseFloat(getComputedStyle(measuring.value).columnGap) || 0;
  let count = Math.min(explicitLimit.value, widths.length);
  while (count > 2) {
    const isCollapsed = count < widths.length;
    const visibleWidths = isCollapsed ? [widths[0]!, overflowWidth, ...widths.slice(widths.length - count + 1)] : widths;
    const required = visibleWidths.reduce((sum, width) => sum + width, 0) + gap * Math.max(0, visibleWidths.length - 1);
    if (required <= available) break;
    count--;
  }
  measuredLimit.value = count;
}
function observe() {
  observer?.disconnect();
  if (props.autoCollapse) {
    if (root.value) observer?.observe(root.value);
    if (measuring.value) observer?.observe(measuring.value);
    measure();
  } else measuredLimit.value = undefined;
}
watch(() => [props.items, props.maxItems, props.autoCollapse], () => {
  if (mounted) observe();
}, { deep: true, flush: "post" });
onMounted(() => {
  mounted = true;
  if (typeof ResizeObserver !== "undefined") observer = new ResizeObserver(measure);
  window.addEventListener("resize", measure);
  observe();
});
onBeforeUnmount(() => {
  mounted = false;
  observer?.disconnect();
  window.removeEventListener("resize", measure);
});
function openAncestors(event: MouseEvent) {
  (controller?.menu ?? useMenuRuntime()).openMenu({
    id: menuId, source: "topbar", anchor: { element: event.currentTarget as HTMLElement },
    items: hidden.value.map((item, index) => ({ kind: "action", id: String(index), label: item.label, disabled: !item.href && !item.onSelect, onSelect: () => { if (item.onSelect) item.onSelect(); else if (item.href) window.location.assign(item.href); } }))
  });
}
</script>

<template>
  <nav v-if="items.length" ref="root" class="flex min-w-0 items-center gap-1 text-small text-text-muted" :class="autoCollapse ? 'relative overflow-hidden' : undefined" aria-label="Breadcrumb">
    <template v-for="(item, index) in items.slice(0, 1)" :key="`${item.label}-${index}`">
      <button v-if="item.onSelect" type="button" class="hover:text-text-secondary" :class="autoCollapse ? 'min-w-0 truncate' : 'shrink-0'" :title="autoCollapse ? item.label : undefined" @click="item.onSelect()">{{ item.label }}</button>
      <a v-else-if="item.href" :href="item.href" class="hover:text-text-secondary" :class="autoCollapse ? 'min-w-0 truncate' : 'shrink-0'" :title="autoCollapse ? item.label : undefined">{{ item.label }}</a>
      <span v-else class="text-text-subtle" :class="autoCollapse ? 'min-w-0 truncate' : 'shrink-0'" :title="autoCollapse ? item.label : undefined">{{ item.label }}</span>
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
    <div v-if="autoCollapse" ref="measuring" class="pointer-events-none invisible absolute left-0 top-0 flex w-max items-center gap-1 whitespace-nowrap" aria-hidden="true" inert>
      <span v-for="(item, index) in items" :key="index" data-breadcrumb-measure-item class="flex shrink-0 items-center gap-1"><span>{{ item.label }}</span><span>/</span></span>
      <span data-breadcrumb-measure-overflow class="flex shrink-0 items-center gap-1"><span class="flex size-6 items-center justify-center"><Ellipsis class="size-4" /></span><span>/</span></span>
    </div>
  </nav>
</template>
