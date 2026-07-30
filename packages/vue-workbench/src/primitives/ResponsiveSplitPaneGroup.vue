<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, useId, useSlots, watch } from "vue";
import { canStartPointerDrag, usePointerDrag } from "../composables/usePointerDrag";
import WorkbenchSash from "./WorkbenchSash.vue";
import WorkbenchTabStrip from "./WorkbenchTabStrip.vue";
import {
  applySplitPaneDividerDelta,
  commitDividerPreferences,
  createSplitPaneSizingSignature,
  getSplitPaneDividerRange,
  paneDefaultSize,
  paneMinSize,
  reconcilePreferredSizes,
  resolvePaneSizes,
  type SplitPaneDividerResult,
  type SplitPaneLayoutAnchor,
  type SplitPaneSizes
} from "./splitPaneSizing";
import type {
  ResponsiveSplitPaneCompactMode,
  ResponsiveSplitPaneItem,
  ResponsiveSplitPaneOrientation,
  ResponsiveSplitPaneSlotScope
} from "./responsiveSplitPaneTypes";

const props = withDefaults(defineProps<{
  panes: readonly ResponsiveSplitPaneItem[];
  breakpoint?: number;
  compactMode?: ResponsiveSplitPaneCompactMode;
  orientation?: ResponsiveSplitPaneOrientation;
  storageKey?: string;
  activePaneId?: string;
  defaultActivePaneId?: string;
}>(), {
  breakpoint: 760,
  compactMode: "tabs",
  orientation: "horizontal"
});

const emit = defineEmits<{
  "update:activePaneId": [paneId: string];
}>();

const groupId = useId();
const slots = useSlots();
const rootRef = ref<HTMLElement | null>(null);
const containerWidth = ref(0);
const containerHeight = ref(0);
const internalActivePaneId = ref(props.defaultActivePaneId ?? "");
const horizontalPreferredSizes = reactive<SplitPaneSizes>({});
const verticalPreferredSizes = reactive<SplitPaneSizes>({});
const horizontalResolvedSizes = reactive<SplitPaneSizes>({});
const verticalResolvedSizes = reactive<SplitPaneSizes>({});
const horizontalAnchor = ref<SplitPaneLayoutAnchor | null>(null);
const verticalAnchor = ref<SplitPaneLayoutAnchor | null>(null);

const normalizedPanes = computed(() => {
  const seen = new Set<string>();
  return props.panes.filter((pane) => {
    if (!pane.id || seen.has(pane.id)) {
      console.warn(`[ResponsiveSplitPaneGroup] Pane ids must be unique and non-empty: "${pane.id}".`);
      return false;
    }
    seen.add(pane.id);
    return true;
  });
});
const sizingSignature = computed(() => createSplitPaneSizingSignature(normalizedPanes.value));
const availablePanes = computed(() => normalizedPanes.value.filter((pane) => !pane.tabDisabled));
const compact = computed(() => containerWidth.value > 0 && containerWidth.value < props.breakpoint);
const stacked = computed(() => compact.value && props.compactMode === "stacked");
const layoutAxis = computed<ResponsiveSplitPaneOrientation>(() => (
  stacked.value ? "vertical" : props.orientation
));
const requestedActivePaneId = computed(() => props.activePaneId ?? internalActivePaneId.value);
const activePaneId = computed(() => {
  const requested = requestedActivePaneId.value;
  return availablePanes.value.some((pane) => pane.id === requested)
    ? requested
    : availablePanes.value[0]?.id ?? "";
});
const tabItems = computed(() => normalizedPanes.value.map((pane, index) => ({
  id: pane.id,
  label: pane.label ?? pane.id,
  title: pane.title,
  disabled: pane.tabDisabled,
  tabId: tabId(index),
  controls: panelId(index)
})));
const activeSizes = computed(() => resolvedSizesForAxis(layoutAxis.value));
const layoutExtent = computed(() => (
  normalizedPanes.value.reduce((total, pane) => total + (activeSizes.value[pane.id] ?? paneMinSize(pane)), 0)
));
const layoutStyle = computed(() => {
  const tracks = normalizedPanes.value.map(
    (pane) => `${Math.max(0, activeSizes.value[pane.id] ?? paneMinSize(pane))}px`
  ).join(" ");
  return layoutAxis.value === "horizontal"
    ? {
        gridTemplateColumns: tracks,
        width: `${Math.max(containerWidth.value, layoutExtent.value)}px`,
        minHeight: "100%"
      }
    : {
        gridTemplateRows: tracks,
        height: `${Math.max(containerHeight.value, layoutExtent.value)}px`,
        minWidth: "100%"
      };
});

let observer: ResizeObserver | null = null;

function storageKey() {
  return props.storageKey ? `${props.storageKey}.splitGroup.v1` : null;
}

function readStoredSizes() {
  const key = storageKey();
  if (!key || typeof window === "undefined") {
    return;
  }
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "null") as {
      horizontal?: Record<string, number>;
      vertical?: Record<string, number>;
      horizontalAnchor?: SplitPaneLayoutAnchor;
      verticalAnchor?: SplitPaneLayoutAnchor;
      sizingSignature?: string;
    } | null;
    for (const [axis, target] of [
      ["horizontal", horizontalPreferredSizes],
      ["vertical", verticalPreferredSizes]
    ] as const) {
      const stored = parsed?.[axis];
      if (!stored) {
        continue;
      }
      for (const pane of normalizedPanes.value) {
        const value = stored[pane.id];
        if (Number.isFinite(value)) {
          target[pane.id] = Number(value);
        }
      }
    }
    const signatureMatches = parsed?.sizingSignature === sizingSignature.value;
    horizontalAnchor.value = signatureMatches ? readStoredAnchor(parsed?.horizontalAnchor) : null;
    verticalAnchor.value = signatureMatches ? readStoredAnchor(parsed?.verticalAnchor) : null;
  } catch {
    // Stored layout is advisory. Invalid data falls back to pane defaults.
  }
}

function clearSizes() {
  for (const target of [
    horizontalPreferredSizes,
    verticalPreferredSizes,
    horizontalResolvedSizes,
    verticalResolvedSizes
  ]) {
    for (const id of Object.keys(target)) {
      delete target[id];
    }
  }
  horizontalAnchor.value = null;
  verticalAnchor.value = null;
}

function writeStoredSizes() {
  const key = storageKey();
  if (!key || typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(key, JSON.stringify({
      horizontal: { ...horizontalPreferredSizes },
      vertical: { ...verticalPreferredSizes },
      horizontalAnchor: horizontalAnchor.value,
      verticalAnchor: verticalAnchor.value,
      sizingSignature: sizingSignature.value
    }));
  } catch {
    // Storage is optional; resizing should continue without persistence.
  }
}

function readStoredAnchor(anchor: SplitPaneLayoutAnchor | undefined) {
  if (!anchor?.sizes || typeof anchor.sizes !== "object") return null;
  const sizes = Object.fromEntries(
    Object.entries(anchor.sizes).filter(([, value]) => Number.isFinite(value))
  );
  const paneIds = normalizedPanes.value.map((pane) => pane.id);
  if (Object.keys(sizes).length !== paneIds.length || paneIds.some((id) => !(id in sizes))) {
    return null;
  }
  return { sizes };
}

function preferredSizesForAxis(axis: ResponsiveSplitPaneOrientation) {
  return axis === "horizontal" ? horizontalPreferredSizes : verticalPreferredSizes;
}

function resolvedSizesForAxis(axis: ResponsiveSplitPaneOrientation) {
  return axis === "horizontal" ? horizontalResolvedSizes : verticalResolvedSizes;
}

function anchorForAxis(axis: ResponsiveSplitPaneOrientation) {
  return axis === "horizontal" ? horizontalAnchor : verticalAnchor;
}

function availableSizeForAxis(axis: ResponsiveSplitPaneOrientation) {
  const containerSize = axis === "horizontal" ? containerWidth.value : containerHeight.value;
  return Math.max(0, containerSize);
}

function assignSizes(target: SplitPaneSizes, source: Readonly<SplitPaneSizes>) {
  for (const id of Object.keys(target)) {
    if (!(id in source)) delete target[id];
  }
  Object.assign(target, source);
}

function reconcilePreferredAxis(axis: ResponsiveSplitPaneOrientation) {
  const preferred = preferredSizesForAxis(axis);
  assignSizes(preferred, reconcilePreferredSizes(normalizedPanes.value, preferred, axis));
}

function resolveAxis(axis: ResponsiveSplitPaneOrientation) {
  reconcilePreferredAxis(axis);
  assignSizes(
    resolvedSizesForAxis(axis),
    resolvePaneSizes(
      normalizedPanes.value,
      preferredSizesForAxis(axis),
      availableSizeForAxis(axis),
      axis,
      anchorForAxis(axis).value
    )
  );
}

function syncSize() {
  const rect = rootRef.value?.getBoundingClientRect();
  containerWidth.value = Math.round(rect?.width ?? 0);
  containerHeight.value = Math.round(rect?.height ?? 0);
  if (containerWidth.value > 0) resolveAxis("horizontal");
  if (containerHeight.value > 0) resolveAxis("vertical");
}

function requestActivePane(paneId: string) {
  if (!availablePanes.value.some((pane) => pane.id === paneId)) {
    return false;
  }
  if (props.activePaneId === undefined) {
    internalActivePaneId.value = paneId;
  }
  emit("update:activePaneId", paneId);
  return true;
}

function paneScope(pane: ResponsiveSplitPaneItem): ResponsiveSplitPaneSlotScope {
  return {
    pane,
    compact: compact.value,
    stacked: stacked.value,
    active: activePaneId.value === pane.id
  };
}

function hasNamedPaneSlot(paneId: string) {
  return Boolean(slots[paneId]);
}

function tabId(index: number) {
  return `${groupId}-tab-${index}`;
}

function panelId(index: number) {
  return `${groupId}-panel-${index}`;
}

type DividerDragState = {
  axis: ResponsiveSplitPaneOrientation;
  dividerIndex: number;
  startPreferredSizes: SplitPaneSizes;
  startResolvedSizes: SplitPaneSizes;
  startAnchor: SplitPaneLayoutAnchor | null;
};

function applyDividerResult(state: DividerDragState, result: SplitPaneDividerResult) {
  assignSizes(resolvedSizesForAxis(state.axis), result.sizes);
  assignSizes(
    preferredSizesForAxis(state.axis),
    commitDividerPreferences(
      normalizedPanes.value,
      state.startPreferredSizes,
      result,
      state.axis
    )
  );
  anchorForAxis(state.axis).value = { sizes: { ...result.sizes } };
}

function applyDividerDelta(state: DividerDragState, delta: number) {
  applyDividerResult(
    state,
    applySplitPaneDividerDelta(
      normalizedPanes.value,
      state.startResolvedSizes,
      state.dividerIndex,
      delta
    )
  );
}

const dividerDrag = usePointerDrag<DividerDragState>({
  onMove({ state, deltaX, deltaY }) {
    applyDividerDelta(state, state.axis === "horizontal" ? deltaX : deltaY);
  },
  onEnd({ state, cancelled }) {
    if (cancelled) {
      assignSizes(preferredSizesForAxis(state.axis), state.startPreferredSizes);
      assignSizes(resolvedSizesForAxis(state.axis), state.startResolvedSizes);
      anchorForAxis(state.axis).value = state.startAnchor;
      return;
    }
    writeStoredSizes();
  },
  cursor: (state) => state.axis === "horizontal" ? "col-resize" : "row-resize"
});
const activeDividerIndex = computed(() => dividerDrag.activeState.value?.dividerIndex ?? -1);

function startDividerResize(event: PointerEvent, dividerIndex: number) {
  if (!canStartPointerDrag(event)) return;
  dividerDrag.stop();
  const axis = layoutAxis.value;
  const preferred = preferredSizesForAxis(axis);
  const resolved = resolvedSizesForAxis(axis);
  dividerDrag.start(event, {
    axis,
    dividerIndex,
    startPreferredSizes: { ...preferred },
    startResolvedSizes: { ...resolved },
    startAnchor: anchorForAxis(axis).value
      ? { sizes: { ...anchorForAxis(axis).value!.sizes } }
      : null
  });
}

function moveDividerBy(dividerIndex: number, delta: number) {
  const axis = layoutAxis.value;
  const preferred = preferredSizesForAxis(axis);
  const resolved = resolvedSizesForAxis(axis);
  applyDividerDelta({
    axis,
    dividerIndex,
    startPreferredSizes: { ...preferred },
    startResolvedSizes: { ...resolved },
    startAnchor: anchorForAxis(axis).value
  }, delta);
  writeStoredSizes();
}

function onDividerKeydown(event: KeyboardEvent, dividerIndex: number) {
  if (layoutAxis.value === "horizontal") {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      moveDividerBy(dividerIndex, event.key === "ArrowRight" ? 16 : -16);
    }
    return;
  }
  if (event.key === "ArrowUp" || event.key === "ArrowDown") {
    event.preventDefault();
    moveDividerBy(dividerIndex, event.key === "ArrowDown" ? 16 : -16);
  }
}

function dividerBoundary(dividerIndex: number) {
  return dividerRange(dividerIndex).now;
}

function dividerRange(dividerIndex: number) {
  return getSplitPaneDividerRange(
    normalizedPanes.value,
    activeSizes.value,
    dividerIndex
  );
}

function dividerStyle(dividerIndex: number) {
  const boundary = Math.round(dividerBoundary(dividerIndex));
  return layoutAxis.value === "horizontal"
    ? { left: `${boundary}px` }
    : { top: `${boundary}px` };
}

function dividerLabel(dividerIndex: number) {
  const before = normalizedPanes.value[dividerIndex];
  const after = normalizedPanes.value[dividerIndex + 1];
  const beforeTitle = before ? before.title ?? before.label ?? before.id : "";
  const afterTitle = after ? after.title ?? after.label ?? after.id : "";
  return `Resize ${beforeTitle} and ${afterTitle}`;
}

function resetLayout(axis = layoutAxis.value) {
  anchorForAxis(axis).value = null;
  assignSizes(
    preferredSizesForAxis(axis),
    Object.fromEntries(normalizedPanes.value.map((pane) => [
      pane.id,
      paneDefaultSize(pane, axis)
    ]))
  );
  resolveAxis(axis);
  writeStoredSizes();
}

function activatePane(paneId: string) {
  return requestActivePane(paneId);
}

defineExpose({
  activatePane,
  resetLayout
});

watch(
  () => props.storageKey,
  () => {
    clearSizes();
    readStoredSizes();
    syncSize();
  }
);

watch(sizingSignature, () => {
    horizontalAnchor.value = null;
    verticalAnchor.value = null;
    reconcilePreferredAxis("horizontal");
    reconcilePreferredAxis("vertical");
    void nextTick(() => {
      syncSize();
      writeStoredSizes();
    });
});

watch(
  [availablePanes, () => props.activePaneId],
  () => {
    const fallback = activePaneId.value;
    if (!fallback || requestedActivePaneId.value === fallback) {
      return;
    }
    if (props.activePaneId === undefined) {
      internalActivePaneId.value = fallback;
    }
    emit("update:activePaneId", fallback);
  },
  { immediate: true }
);

onMounted(() => {
  readStoredSizes();
  syncSize();
  observer = new ResizeObserver(syncSize);
  if (rootRef.value) {
    observer.observe(rootRef.value);
  }
});

onBeforeUnmount(() => {
  observer?.disconnect();
});

watch(() => props.compactMode, () => {
  void nextTick(syncSize);
});

watch(() => props.breakpoint, syncSize);

watch(() => props.orientation, () => {
  void nextTick(syncSize);
});

</script>

<template>
  <div ref="rootRef" class="h-full min-h-0 min-w-0">
    <div v-if="compact && compactMode === 'tabs'" class="flex h-full min-h-0 flex-col overflow-hidden">
      <WorkbenchTabStrip
        :items="tabItems"
        :model-value="activePaneId"
        bordered
        @update:model-value="requestActivePane"
      />
      <div class="min-h-0 flex-1 overflow-hidden">
        <div
          v-for="pane in normalizedPanes"
          v-show="pane.id === activePaneId"
          :key="pane.id"
          :id="panelId(normalizedPanes.indexOf(pane))"
          class="h-full min-h-0 min-w-0 overflow-hidden"
          role="tabpanel"
          :aria-labelledby="tabId(normalizedPanes.indexOf(pane))"
        >
          <slot
            v-if="hasNamedPaneSlot(pane.id)"
            :name="pane.id"
            v-bind="paneScope(pane)"
          />
          <slot v-else name="pane" v-bind="paneScope(pane)" />
        </div>
      </div>
    </div>

    <div
      v-else
      class="h-full min-h-0 min-w-0"
      :class="layoutAxis === 'horizontal' ? 'overflow-x-auto overflow-y-hidden' : 'overflow-x-hidden overflow-y-auto'"
    >
      <div class="relative isolate grid min-h-0 min-w-0 overflow-hidden" :style="layoutStyle">
        <template v-for="pane in normalizedPanes" :key="pane.id">
          <div class="min-h-0 min-w-0 overflow-hidden">
            <slot
              v-if="hasNamedPaneSlot(pane.id)"
              :name="pane.id"
              v-bind="paneScope(pane)"
            />
            <slot v-else name="pane" v-bind="paneScope(pane)" />
          </div>
        </template>
        <WorkbenchSash
          v-for="dividerIndex in Math.max(0, normalizedPanes.length - 1)"
          :key="`sash-${dividerIndex - 1}`"
          :orientation="layoutAxis === 'horizontal' ? 'vertical' : 'horizontal'"
          :active="activeDividerIndex === dividerIndex - 1"
          :style="dividerStyle(dividerIndex - 1)"
          :label="dividerLabel(dividerIndex - 1)"
          :value-now="Math.round(dividerRange(dividerIndex - 1).now)"
          :value-min="Math.round(dividerRange(dividerIndex - 1).min)"
          :value-max="Math.round(dividerRange(dividerIndex - 1).max)"
          :value-text="`${Math.round(dividerRange(dividerIndex - 1).now)} pixels`"
          @pointerdown="startDividerResize($event, dividerIndex - 1)"
          @dblclick="resetLayout()"
          @keydown="onDividerKeydown($event, dividerIndex - 1)"
        />
      </div>
    </div>
  </div>
</template>
