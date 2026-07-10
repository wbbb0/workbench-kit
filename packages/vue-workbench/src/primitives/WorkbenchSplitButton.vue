<script setup lang="ts">
import { ChevronDown } from "lucide-vue-next";
import { computed, ref, type Component } from "vue";
import { useMenuRuntime } from "../menu/useMenuRuntime.js";
import WorkbenchButton from "./WorkbenchButton.vue";
import type { WorkbenchButtonAction, WorkbenchButtonColors, WorkbenchButtonVariant } from "./buttonTypes.js";

const props = withDefaults(defineProps<{
  actions: WorkbenchButtonAction[];
  primaryActionId: string;
  showLastUsedAction?: boolean;
  lastUsedActionId?: string;
  disabled?: boolean;
  variant?: WorkbenchButtonVariant;
  colors?: WorkbenchButtonColors;
  type?: "button" | "submit" | "reset";
}>(), {
  showLastUsedAction: false,
  lastUsedActionId: undefined,
  disabled: false,
  variant: "primary",
  colors: undefined,
  type: "button"
});

const emit = defineEmits<{
  action: [action: WorkbenchButtonAction];
  "update:lastUsedActionId": [actionId: string];
}>();

const { openMenu } = useMenuRuntime();
const internalLastUsedActionId = ref("");
const menuId = `workbench-split-button-${Math.random().toString(36).slice(2)}`;

const lastUsedActionId = computed(() => props.lastUsedActionId ?? internalLastUsedActionId.value);
const configuredPrimaryAction = computed(() => props.actions.find((action) => action.id === props.primaryActionId));
const primaryAction = computed(() => {
  const lastAction = props.actions.find((action) => action.id === lastUsedActionId.value);
  return props.showLastUsedAction && lastAction ? lastAction : configuredPrimaryAction.value;
});
const menuActions = computed(() => props.actions.filter((action) => action.id !== primaryAction.value?.id));

function invokeAction(action: WorkbenchButtonAction) {
  if (props.disabled || action.disabled) {
    return;
  }
  internalLastUsedActionId.value = action.id;
  emit("update:lastUsedActionId", action.id);
  emit("action", action);
}

function openActions(event: MouseEvent) {
  if (props.disabled) {
    return;
  }
  openMenu({
    id: menuId,
    source: "contextmenu",
    anchor: { element: event.currentTarget as HTMLElement | null },
    placement: "bottom-end",
    items: menuActions.value.map((action) => ({
      kind: "action" as const,
      id: action.id,
      label: action.label,
      icon: action.icon as Component | undefined,
      disabled: action.disabled,
      onSelect: () => invokeAction(action)
    }))
  });
}
</script>

<template>
  <div class="workbench-split-button inline-flex" role="group" :aria-label="primaryAction?.label || 'Actions'">
    <WorkbenchButton
      :icon="primaryAction?.icon"
      :label="primaryAction?.label || ''"
      :title="primaryAction?.title"
      :disabled="disabled || !primaryAction || primaryAction.disabled"
      :variant="variant"
      :colors="colors"
      :type="type"
      class="workbench-split-button-main"
      @click="primaryAction && invokeAction(primaryAction)"
    />
    <WorkbenchButton
      :icon="ChevronDown"
      title="More actions"
      aria-label="More actions"
      :disabled="disabled || menuActions.length === 0"
      :variant="variant"
      :colors="colors"
      type="button"
      class="workbench-split-button-menu"
      data-menu-trigger="true"
      @click="openActions"
    />
  </div>
</template>
