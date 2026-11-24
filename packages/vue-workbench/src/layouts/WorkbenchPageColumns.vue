<script setup lang="ts" generic="P extends WorkbenchColumnPage">
import {
  computed,
  inject,
  nextTick,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  ref,
  shallowRef,
  watch,
} from "vue";
import {
  mobilePageColumns,
  pageColumnCapacity,
  type WorkbenchColumnPage,
} from "../runtime/pageColumns";
import { pageMotionDirection } from "../runtime/usePageMotion";

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

const transition = shallowRef<{ from: P; direction: "forward" | "back" }>();
const returningFrom = shallowRef<P>();
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
let media: MediaQueryList | undefined;
let animations: Animation[] = [];
let generation = 0;
function stop() {
  generation++;
  for (const animation of animations) animation.cancel();
  animations = [];
  transition.value = undefined;
}
function measure(value: number) {
  if (!active.value || value <= 0 || value === width.value) return;
  stop();
  width.value = value;
}
function deactivate() {
  active.value = false;
  stop();
}
function motionPreferenceChanged() {
  if (media?.matches) stop();
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
  media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  media?.addEventListener?.("change", motionPreferenceChanged);
});
onActivated(() => {
  active.value = true;
  if (viewport.value) measure(viewport.value.getBoundingClientRect().width);
});
onDeactivated(deactivate);
onBeforeUnmount(() => {
  deactivate();
  observer?.disconnect();
  media?.removeEventListener?.("change", motionPreferenceChanged);
});

watch(
  [() => props.pages, capacity, () => props.motionEpoch],
  async ([pages, cols, epoch], [previous, oldCols, oldEpoch]) => {
    const from = previous.at(-1);
    const to = pages.at(-1);
    const sameLayout = cols === oldCols && epoch === oldEpoch;
    if (sameLayout && from?.key === to?.key) return;
    stop();
    const turn = generation;
    const locate = (chain: readonly P[]) => ({
      viewId: "",
      keys: chain.map(({ key }) => key),
    });
    const direction =
      sameLayout &&
      from &&
      to &&
      pageMotionDirection(locate(previous), locate(pages));
    returningFrom.value =
      direction === "back" && document.activeElement?.matches(":focus-visible")
        ? previous[pages.length]
        : undefined;
    const element = viewport.value;
    if (
      !active.value ||
      cols !== 1 ||
      !direction ||
      !from ||
      !element?.animate ||
      media?.matches
    )
      return;

    transition.value = { from, direction };
    await nextTick();
    if (turn !== generation) return;
    const [under, over] = Array.from(element.children) as HTMLElement[];
    if (!under || !over) {
      stop();
      return;
    }
    const run = (layer: HTMLElement, start: number, end: number) =>
      layer.animate(
        [
          { transform: `translateX(${start}%)` },
          { transform: `translateX(${end}%)` },
        ],
        { duration: 220, easing: "cubic-bezier(.22,.68,.24,1)", fill: "both" },
      );
    animations =
      direction === "forward"
        ? [run(under, 0, -18), run(over, 100, 0)]
        : [run(under, -18, 0), run(over, 0, 100)];
    try {
      await Promise.all(animations.map((animation) => animation.finished));
    } catch {
      // cancel() rejects finished; only this generation can clean up its surfaces.
    }
    if (turn === generation) stop();
  },
);
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
        class="panel-header shrink-0 truncate px-3 text-sm font-medium"
        style="height: 36px"
      >
        {{ page.title }}
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
