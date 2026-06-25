<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";

const props = withDefaults(defineProps<{
  breakpoint?: number;
  defaultPrimarySize?: number;
  defaultStackedPrimarySize?: number;
  minPrimarySize?: number;
  minSecondarySize?: number;
  primaryPosition?: "start" | "end";
  storageKey?: string;
}>(), {
  breakpoint: 760,
  defaultPrimarySize: 360,
  defaultStackedPrimarySize: 240,
  minPrimarySize: 240,
  minSecondarySize: 240,
  primaryPosition: "start"
});

type ResizeAxis = "x" | "y";
type ActiveResize = {
  axis: ResizeAxis;
  startPointer: number;
  startSize: number;
};

const rootRef = ref<HTMLElement | null>(null);
const containerWidth = ref(0);
const containerHeight = ref(0);
const horizontalSize = ref(readStoredSize("horizontal", props.defaultPrimarySize));
const verticalSize = ref(readStoredSize("vertical", props.defaultStackedPrimarySize));
const stacked = computed(() => containerWidth.value > 0 && containerWidth.value < props.breakpoint);
const currentSize = computed(() => stacked.value ? verticalSize.value : horizontalSize.value);
const resizeDirection = computed(() => props.primaryPosition === "start" ? 1 : -1);
const primarySlot = computed(() => ({ name: "primary" as const, primary: true }));
const secondarySlot = computed(() => ({ name: "secondary" as const, primary: false }));
const orderedSlots = computed(() => (
  props.primaryPosition === "start"
    ? [primarySlot.value, secondarySlot.value]
    : [secondarySlot.value, primarySlot.value]
));
const gridStyle = computed(() => {
  const primarySize = stacked.value ? clampVerticalSize(verticalSize.value) : clampHorizontalSize(horizontalSize.value);
  const template = props.primaryPosition === "start"
    ? `${primarySize}px 1px minmax(0, 1fr)`
    : `minmax(0, 1fr) 1px ${primarySize}px`;
  return stacked.value
    ? { gridTemplateRows: template }
    : { gridTemplateColumns: template };
});

let observer: ResizeObserver | null = null;
let activeResize: ActiveResize | null = null;

function storageKey(orientation: "horizontal" | "vertical") {
  return props.storageKey ? `${props.storageKey}.${orientation}.primarySize` : null;
}

function readStoredSize(orientation: "horizontal" | "vertical", fallback: number): number {
  const key = storageKey(orientation);
  if (!key || typeof window === "undefined") return fallback;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    return fallback;
  }
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function writeStoredSize(orientation: "horizontal" | "vertical", value: number) {
  const key = storageKey(orientation);
  if (!key || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, String(Math.round(value)));
  } catch {
    // Storage is optional; drag behavior should still work without persistence.
  }
}

function syncSize() {
  const rect = rootRef.value?.getBoundingClientRect();
  containerWidth.value = Math.round(rect?.width ?? 0);
  containerHeight.value = Math.round(rect?.height ?? 0);
}

function clampHorizontalSize(value: number) {
  const max = Math.max(props.minPrimarySize, containerWidth.value - props.minSecondarySize);
  return Math.min(max, Math.max(props.minPrimarySize, value));
}

function clampVerticalSize(value: number) {
  const max = Math.max(props.minPrimarySize, containerHeight.value - props.minSecondarySize);
  return Math.min(max, Math.max(props.minPrimarySize, value));
}

function setPrimarySize(value: number) {
  if (stacked.value) {
    verticalSize.value = clampVerticalSize(value);
    writeStoredSize("vertical", verticalSize.value);
  } else {
    horizontalSize.value = clampHorizontalSize(value);
    writeStoredSize("horizontal", horizontalSize.value);
  }
}

function pointerPosition(event: PointerEvent, axis: ResizeAxis) {
  return axis === "x" ? event.clientX : event.clientY;
}

function resize(event: PointerEvent) {
  if (!activeResize) return;
  const delta = (pointerPosition(event, activeResize.axis) - activeResize.startPointer) * resizeDirection.value;
  setPrimarySize(activeResize.startSize + delta);
}

function stopResize() {
  activeResize = null;
  window.removeEventListener("pointermove", resize);
  window.removeEventListener("pointerup", stopResize);
  window.removeEventListener("pointercancel", stopResize);
}

function startResize(event: PointerEvent) {
  if (event.button !== 0) return;
  event.preventDefault();
  const axis = stacked.value ? "y" : "x";
  activeResize = {
    axis,
    startPointer: pointerPosition(event, axis),
    startSize: currentSize.value
  };
  window.addEventListener("pointermove", resize);
  window.addEventListener("pointerup", stopResize);
  window.addEventListener("pointercancel", stopResize);
}

function resetSize() {
  if (stacked.value) {
    verticalSize.value = props.defaultStackedPrimarySize;
    writeStoredSize("vertical", verticalSize.value);
  } else {
    horizontalSize.value = props.defaultPrimarySize;
    writeStoredSize("horizontal", horizontalSize.value);
  }
}

function resizeBy(delta: number) {
  setPrimarySize(currentSize.value + delta);
}

function onKeydown(event: KeyboardEvent) {
  if (stacked.value) {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      resizeBy(-16 * resizeDirection.value);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      resizeBy(16 * resizeDirection.value);
    }
    return;
  }
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    resizeBy(-16 * resizeDirection.value);
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    resizeBy(16 * resizeDirection.value);
  }
}

onMounted(() => {
  syncSize();
  observer = new ResizeObserver(syncSize);
  if (rootRef.value) observer.observe(rootRef.value);
});

onUnmounted(() => {
  observer?.disconnect();
  stopResize();
});

watch(() => props.storageKey, () => {
  horizontalSize.value = readStoredSize("horizontal", props.defaultPrimarySize);
  verticalSize.value = readStoredSize("vertical", props.defaultStackedPrimarySize);
});
</script>

<template>
  <div ref="rootRef" class="grid h-full min-h-0" :style="gridStyle">
    <template v-for="(pane, index) in orderedSlots" :key="pane.name">
      <div class="min-h-0 min-w-0 overflow-hidden">
        <slot v-if="pane.primary" name="primary" :stacked="stacked" />
        <slot v-else name="secondary" :stacked="stacked" />
      </div>
      <div
        v-if="index === 0"
        class="z-20 bg-transparent hover:bg-accent/25 focus:bg-accent/25 focus:outline-none"
        :class="stacked
          ? 'h-1 cursor-row-resize border-t border-border-default bg-surface-sidebar'
          : 'relative -mx-0.5 w-1 cursor-col-resize before:absolute before:inset-y-0 before:left-1/2 before:w-px before:-translate-x-1/2 before:bg-border-default'"
        role="separator"
        :aria-orientation="stacked ? 'horizontal' : 'vertical'"
        :aria-valuenow="currentSize"
        tabindex="0"
        @pointerdown="startResize"
        @dblclick="resetSize"
        @keydown="onKeydown"
      />
    </template>
  </div>
</template>
