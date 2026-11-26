<script setup lang="ts">
import { computed } from "vue";
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-vue-next";
import { WORKBENCH_RUNTIME_LAYERS } from "../runtime/layers.js";
import type { ToastItem } from "./toastService.js";
import { useWorkbenchToasts } from "./useWorkbenchToasts";

const toast = useWorkbenchToasts();

const toasts = computed(() => toast.items.value);
const hostStyle = {
  zIndex: WORKBENCH_RUNTIME_LAYERS.toastHost
};

function iconFor(type: ToastItem["type"]) {
  if (type === "success") return CheckCircle2;
  if (type === "warning") return AlertTriangle;
  if (type === "error") return AlertCircle;
  return Info;
}

function toneClassFor(type: ToastItem["type"]) {
  if (type === "success") {
    return "border-border-success bg-surface-success text-success";
  }
  if (type === "warning") {
    return "border-border-warning bg-surface-warning text-warning";
  }
  if (type === "error") {
    return "border-border-danger bg-surface-danger text-danger";
  }
  return "border-border-info bg-surface-info text-info";
}
</script>

<template>
  <div class="pointer-events-none fixed inset-x-0 top-0 flex justify-center px-3 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)]" :style="hostStyle">
    <div class="flex w-full max-w-xl flex-col gap-2">
      <button
        v-for="item in toasts"
        :key="item.id"
        type="button"
        class="pointer-events-auto flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left shadow-lg backdrop-blur-sm transition-transform hover:-translate-y-px"
        :class="toneClassFor(item.type)"
        @click="toast.dismiss(item.id)"
      >
        <component :is="iconFor(item.type)" :size="16" :stroke-width="2" class="mt-0.5 shrink-0" />
        <span class="min-w-0 flex-1 text-ui leading-6 wrap-break-word">{{ item.message }}</span>
      </button>
    </div>
  </div>
</template>
