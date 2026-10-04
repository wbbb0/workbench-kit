<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from "vue";
import { Ellipsis } from "lucide-vue-next";
import { useMenuRuntime } from "../menu/useMenuRuntime.js";
import WorkbenchButton from "./WorkbenchButton.vue";
import { fitToolbarActions, type WorkbenchToolbarAction } from "./actionToolbarTypes.js";

const props = withDefaults(defineProps<{
  actions: readonly WorkbenchToolbarAction[];
  moreLabel?: string;
  label?: string;
}>(), { moreLabel: "更多", label: "操作" });
const emit = defineEmits<{ action: [id: string] }>();
const menu = useMenuRuntime();
const menuId = useId();
const root = ref<HTMLElement>();
const measuring = ref<HTMLElement>();
const visibleIds = ref<Set<string> | null>(null);
const visible = computed(() => props.actions.filter(action => visibleIds.value === null || visibleIds.value.has(action.id)));
const overflow = computed(() => props.actions.filter(action => visibleIds.value !== null && !visibleIds.value.has(action.id)));
let observer: ResizeObserver | undefined;
let mounted = false;

function measure() {
  if (!root.value || !measuring.value) return;
  const available = root.value.getBoundingClientRect().width;
  if (!available) return;
  const buttons = Array.from(measuring.value.querySelectorAll<HTMLElement>("button"));
  const widths = buttons.slice(0, props.actions.length).map(button => button.getBoundingClientRect().width);
  const moreWidth = buttons.at(-1)?.getBoundingClientRect().width ?? 32;
  visibleIds.value = fitToolbarActions(props.actions, widths, available, moreWidth);
}
function invoke(id: string) {
  const current = props.actions.find(action => action.id === id);
  if (current && !current.disabled) emit("action", id);
}
function openMore(event: MouseEvent) {
  menu.openMenu({
    id: menuId,
    source: "topbar",
    anchor: { element: event.currentTarget as HTMLElement },
    placement: "bottom-end",
    items: overflow.value.map(action => ({
      kind: "action", id: action.id, label: action.label, icon: action.icon,
      disabled: action.disabled, danger: action.variant === "danger",
      onSelect: () => invoke(action.id)
    }))
  });
}
watch(() => props.actions, async () => {
  await nextTick();
  if (!mounted) return;
  observer?.disconnect();
  if (root.value) observer?.observe(root.value);
  if (measuring.value) observer?.observe(measuring.value);
  measure();
}, { deep: true });
onMounted(() => {
  mounted = true;
  if (typeof ResizeObserver !== "undefined") {
    observer = new ResizeObserver(measure);
    if (root.value) observer.observe(root.value);
    if (measuring.value) observer.observe(measuring.value);
  }
  window.addEventListener("resize", measure);
  measure();
});
onBeforeUnmount(() => {
  mounted = false;
  observer?.disconnect();
  window.removeEventListener("resize", measure);
});
</script>

<template>
  <div ref="root" class="workbench-action-toolbar relative flex min-w-0 w-full overflow-hidden items-center gap-1" role="group" :aria-label="label">
    <WorkbenchButton v-for="action in visible" :key="action.id" class="shrink-0" :label="action.label" :icon="action.icon" :title="action.title" :disabled="action.disabled" :variant="action.variant || 'secondary'" @click="invoke(action.id)" />
    <WorkbenchButton v-if="overflow.length" class="shrink-0" :icon="Ellipsis" :title="moreLabel" :aria-label="moreLabel" data-menu-trigger="true" aria-haspopup="menu" @click="openMore" />
    <div ref="measuring" class="pointer-events-none invisible absolute left-0 top-0 flex w-max gap-1" aria-hidden="true" inert>
      <WorkbenchButton v-for="action in actions" :key="action.id" :label="action.label" :icon="action.icon" :variant="action.variant || 'secondary'" tabindex="-1" />
      <WorkbenchButton :icon="Ellipsis" :title="moreLabel" tabindex="-1" />
    </div>
  </div>
</template>
