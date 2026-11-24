<script setup lang="ts" generic="P extends WorkbenchColumnPage">
import {
  computed,
  inject,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  ref,
} from "vue";
import {
  mobilePageColumns,
  pageColumnCapacity,
  type WorkbenchColumnPage,
} from "../runtime/pageColumns";
import { usePageSurfaceMotion } from "../runtime/usePageMotion";

const props = defineProps<{
  pages: readonly P[];
  minColumnWidth?: number;
  motionEpoch?: number;
}>();
defineSlots<{
  default(props: {
    page: P;
    selectedChild?: P;
    current: boolean;
    returningFrom?: P;
  }): unknown;
}>();

const mobile = inject(mobilePageColumns, undefined);
const viewport = ref<HTMLElement>();
const width = ref(0);
const active = ref(true);
const minimum = computed(() => {
  const value = props.minColumnWidth;
  return value !== undefined && Number.isFinite(value) && value > 0
    ? value
    : 280;
});
const capacity = computed(() =>
  mobile?.value ? 1 : pageColumnCapacity(width.value, minimum.value),
);
const current = computed(() => props.pages.at(-1));

const { transition, returningFrom, cancel } = usePageSurfaceMotion(
  computed(() => ({
    pages: props.pages,
    layoutKey: JSON.stringify([width.value, capacity.value, props.motionEpoch]),
    enabled: active.value && capacity.value === 1,
  })),
  () => {
    const [under, over] = Array.from(
      viewport.value?.children ?? [],
    ) as HTMLElement[];
    return [under ?? null, over ?? null];
  },
);
const layers = computed(() => {
  const visible = props.pages.slice(-capacity.value);
  const motion = transition.value;
  return motion
    ? motion.direction === "forward"
      ? [motion.from, ...visible]
      : [...visible, motion.from]
    : visible;
});

let observer: ResizeObserver | undefined;
function measure(value: number) {
  if (!active.value || value <= 0 || value === width.value) return;
  width.value = value;
}
function deactivate() {
  active.value = false;
  cancel();
}
onMounted(() => {
  const element = viewport.value!;
  measure(element.clientWidth);
  if (typeof ResizeObserver !== "undefined") {
    observer = new ResizeObserver(([entry]) => {
      if (entry) measure(entry.contentRect.width);
    });
    observer.observe(element);
  }
});
onActivated(() => {
  active.value = true;
  if (viewport.value) measure(viewport.value.getBoundingClientRect().width);
});
onDeactivated(deactivate);
onBeforeUnmount(() => {
  deactivate();
  observer?.disconnect();
});
</script>

<template>
  <div
    ref="viewport"
    class="page-columns relative isolate flex min-h-0 min-w-0 flex-1 overflow-hidden bg-surface-app"
    :class="{
      'is-transitioning': transition,
      'is-multiple': layers.length > 1 && !transition,
    }"
    :style="{
      '--column-min': minimum + 'px',
      '--ancestor-max': Math.max(minimum, 340) + 'px',
    }"
  >
    <section
      v-for="(page, index) in layers"
      :key="page.key"
      class="page-column flex min-h-0 min-w-0 flex-col overflow-hidden bg-surface-app"
      :class="{ 'is-current': page.key === current?.key }"
      :aria-label="page.title"
      @click.self="
        page.key !== current?.key && transition && $event.stopPropagation()
      "
    >
      <header
        v-if="capacity > 1 && layers.length > 1 && !transition"
        class="panel-header flex h-9 shrink-0 items-center border-b px-3 text-sm font-medium"
      >
        <span class="min-w-0 truncate">{{ page.title }}</span>
      </header>
      <div
        class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
        :inert="!!transition && page.key !== current?.key"
      >
        <slot
          :page="page"
          :current="page.key === current?.key"
          :selected-child="transition ? undefined : layers[index + 1]"
          :returning-from="
            page.key === current?.key ? returningFrom : undefined
          "
        />
      </div>
    </section>
  </div>
</template>

<style scoped>
.page-columns {
  overflow: clip;
}
.page-column {
  flex: 1 1 0;
}
.is-multiple {
  gap: 1px;
}
.is-multiple > .page-column {
  min-width: var(--column-min);
  flex-basis: var(--column-min);
}
.is-multiple > .page-column:not(.is-current) {
  flex-grow: 1;
  max-width: var(--ancestor-max);
  box-shadow: 1px 0 var(--color-border-default);
}
.is-multiple > .is-current {
  flex-grow: 2;
}
.is-transitioning > .page-column {
  position: absolute;
  inset: 0;
}
</style>
