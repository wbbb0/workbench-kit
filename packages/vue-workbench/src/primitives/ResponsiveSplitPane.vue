<script setup lang="ts">
import { computed, ref } from "vue";
import ResponsiveSplitPaneGroup from "./ResponsiveSplitPaneGroup.vue";
import type {
  ResponsiveSplitPaneCompactMode,
  ResponsiveSplitPaneItem
} from "./responsiveSplitPaneTypes";

defineOptions({
  inheritAttrs: false
});

const props = withDefaults(defineProps<{
  breakpoint?: number;
  defaultPrimarySize?: number;
  defaultStackedPrimarySize?: number;
  minPrimarySize?: number;
  minSecondarySize?: number;
  primaryPosition?: "start" | "end";
  storageKey?: string;
  compactMode?: ResponsiveSplitPaneCompactMode;
  primaryTitle?: string;
  secondaryTitle?: string;
  activePaneId?: "primary" | "secondary";
  defaultActivePaneId?: "primary" | "secondary";
}>(), {
  breakpoint: 760,
  defaultPrimarySize: 360,
  defaultStackedPrimarySize: 240,
  minPrimarySize: 240,
  minSecondarySize: 240,
  primaryPosition: "start",
  compactMode: "tabs",
  primaryTitle: "Primary",
  secondaryTitle: "Secondary"
});

const emit = defineEmits<{
  "update:activePaneId": [paneId: "primary" | "secondary"];
}>();

const groupRef = ref<{
  activatePane: (paneId: string) => boolean;
  resetLayout: () => void;
} | null>(null);

const primaryPane = computed<ResponsiveSplitPaneItem>(() => ({
  id: "primary",
  label: props.primaryTitle,
  defaultSize: props.defaultPrimarySize,
  defaultCompactSize: props.defaultStackedPrimarySize,
  minSize: props.minPrimarySize,
  grow: 0,
  growPriority: 0,
  shrinkPriority: 100
}));
const secondaryPane = computed<ResponsiveSplitPaneItem>(() => ({
  id: "secondary",
  label: props.secondaryTitle,
  minSize: props.minSecondarySize,
  grow: 1,
  growPriority: 100,
  shrinkPriority: 0
}));
const panes = computed(() => (
  props.primaryPosition === "start"
    ? [primaryPane.value, secondaryPane.value]
    : [secondaryPane.value, primaryPane.value]
));

function updateActivePaneId(paneId: string) {
  if (paneId === "primary" || paneId === "secondary") {
    emit("update:activePaneId", paneId);
  }
}

function activatePane(paneId: "primary" | "secondary") {
  return groupRef.value?.activatePane(paneId) ?? false;
}

function resetSize() {
  groupRef.value?.resetLayout();
}

defineExpose({
  activatePane,
  resetSize
});
</script>

<template>
  <ResponsiveSplitPaneGroup
    ref="groupRef"
    v-bind="$attrs"
    :panes="panes"
    :breakpoint="breakpoint"
    :compact-mode="compactMode"
    :storage-key="storageKey"
    :active-pane-id="activePaneId"
    :default-active-pane-id="defaultActivePaneId"
    @update:active-pane-id="updateActivePaneId"
  >
    <template #primary="scope">
      <slot
        name="primary"
        :stacked="scope.stacked"
        :compact="scope.compact"
        :compact-mode="compactMode"
        :active="scope.active"
      />
    </template>
    <template #secondary="scope">
      <slot
        name="secondary"
        :stacked="scope.stacked"
        :compact="scope.compact"
        :compact-mode="compactMode"
        :active="scope.active"
      />
    </template>
  </ResponsiveSplitPaneGroup>
</template>
