<script setup lang="ts">
import { computed, onUnmounted, watch } from "vue";
import MenuHost from "./menu/MenuHost.vue";
import { activateWorkbenchController, createWorkbenchController, provideWorkbenchController } from "./runtime/workbenchController";
import ToastViewport from "./toasts/ToastViewport.vue";
import type { WorkbenchView } from "./types";
import WindowHost from "./windows/WindowHost.vue";

const props = withDefaults(defineProps<{
  view: WorkbenchView;
  isMobile?: boolean;
}>(), {
  isMobile: false
});

const controller = createWorkbenchController(computed(() => props.view));
provideWorkbenchController(controller);

const { closeAllMenus } = controller.menu;
const { desktopWindows, mobileWindows } = controller.windows;
const renderedWindows = computed(() => (props.isMobile ? mobileWindows.value : desktopWindows.value));
const activeModalWindowId = computed(() => (
  [...renderedWindows.value].reverse().find((window) => window.definition.modal)?.id ?? null
));
const deactivateController = activateWorkbenchController(controller);

watch(activeModalWindowId, (windowId) => {
  if (windowId) {
    closeAllMenus();
  }
});

onUnmounted(deactivateController);
</script>

<template>
  <slot :runtime="controller.runtime" :controller="controller" />
  <MenuHost />
  <ToastViewport />
  <WindowHost :is-mobile="isMobile" />
</template>
