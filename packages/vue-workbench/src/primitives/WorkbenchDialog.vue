<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = withDefaults(defineProps<{
  modelValue: boolean;
  title?: string;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  acceptKeyboardConfirm?: boolean;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  ariaLabel?: string;
  movable?: boolean;
  resizable?: boolean;
  initialWidthPx?: number;
  initialHeightPx?: number;
  minWidthPx?: number;
  minHeightPx?: number;
}>(), {
  title: "",
  size: "md",
  acceptKeyboardConfirm: false,
  closeOnBackdrop: true,
  closeOnEscape: true,
  ariaLabel: "",
  movable: false,
  resizable: false,
  initialWidthPx: 0,
  initialHeightPx: 0,
  minWidthPx: 320,
  minHeightPx: 220
});

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  close: [];
  cancel: [];
  confirm: [];
}>();

const dialogRef = ref<HTMLElement | null>(null);
const frame = ref({
  x: 0,
  y: 0,
  width: 0,
  height: 0
});
const dragState = ref<null | {
  mode: "move" | "resize";
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
}>(null);

const sizeClass = computed(() => ({
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
  full: "max-w-[calc(100vw-2rem)]"
}[props.size]));
const usesFloatingFrame = computed(() => props.movable || props.resizable);
const dialogStyle = computed(() => {
  if (!usesFloatingFrame.value) {
    return undefined;
  }

  return {
    left: `${frame.value.x}px`,
    top: `${frame.value.y}px`,
    width: `${frame.value.width}px`,
    height: `${frame.value.height}px`
  };
});

function defaultWidth() {
  const widthBySize = {
    sm: 384,
    md: 448,
    lg: 512,
    xl: 672,
    full: window.innerWidth - 32
  }[props.size];
  return props.initialWidthPx || widthBySize;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function resetFrame() {
  if (!usesFloatingFrame.value || typeof window === "undefined") {
    return;
  }

  const maxWidth = Math.max(props.minWidthPx, window.innerWidth - 32);
  const maxHeight = Math.max(props.minHeightPx, window.innerHeight - 32);
  const width = clamp(defaultWidth(), props.minWidthPx, maxWidth);
  const height = clamp(props.initialHeightPx || 420, props.minHeightPx, maxHeight);
  frame.value = {
    width,
    height,
    x: Math.round((window.innerWidth - width) / 2),
    y: Math.round((window.innerHeight - height) / 2)
  };
}

function close() {
  emit("update:modelValue", false);
  emit("close");
}

function cancel() {
  emit("update:modelValue", false);
  emit("cancel");
}

function confirm() {
  emit("confirm");
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return ["input", "textarea", "select"].includes(tagName) || target.isContentEditable;
}

function onKeydown(event: KeyboardEvent) {
  if (!props.modelValue) {
    return;
  }

  if (event.key === "Escape" && props.closeOnEscape) {
    event.preventDefault();
    cancel();
    return;
  }

  if (!props.acceptKeyboardConfirm || isTypingTarget(event.target)) {
    return;
  }

  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    confirm();
  }
}

function onPointerMove(event: PointerEvent) {
  if (!dragState.value) {
    return;
  }

  const deltaX = event.clientX - dragState.value.startClientX;
  const deltaY = event.clientY - dragState.value.startClientY;

  if (dragState.value.mode === "move") {
    frame.value = {
      ...frame.value,
      x: clamp(dragState.value.startX + deltaX, 0, window.innerWidth - frame.value.width),
      y: clamp(dragState.value.startY + deltaY, 0, window.innerHeight - frame.value.height)
    };
    return;
  }

  const width = clamp(
    dragState.value.startWidth + deltaX,
    props.minWidthPx,
    window.innerWidth - dragState.value.startX
  );
  const height = clamp(
    dragState.value.startHeight + deltaY,
    props.minHeightPx,
    window.innerHeight - dragState.value.startY
  );
  frame.value = {
    ...frame.value,
    width,
    height
  };
}

function clearDragState() {
  dragState.value = null;
  document.body.style.userSelect = "";
  window.removeEventListener("pointermove", onPointerMove);
  window.removeEventListener("pointerup", clearDragState);
  window.removeEventListener("pointercancel", clearDragState);
}

function startInteraction(event: PointerEvent, mode: "move" | "resize") {
  if ((mode === "move" && !props.movable) || (mode === "resize" && !props.resizable)) {
    return;
  }

  event.preventDefault();
  dragState.value = {
    mode,
    pointerId: event.pointerId,
    startClientX: event.clientX,
    startClientY: event.clientY,
    startX: frame.value.x,
    startY: frame.value.y,
    startWidth: frame.value.width,
    startHeight: frame.value.height
  };
  document.body.style.userSelect = "none";
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", clearDragState);
  window.addEventListener("pointercancel", clearDragState);
}

watch(
  () => props.modelValue,
  async (open) => {
    if (typeof document === "undefined") {
      return;
    }

    document.body.style.overflow = open ? "hidden" : "";

    if (open) {
      resetFrame();
      await nextTick();
      dialogRef.value?.focus();
    }
  },
  { immediate: true }
);

onMounted(() => {
  window.addEventListener("keydown", onKeydown);
});

onBeforeUnmount(() => {
  if (typeof document !== "undefined") {
    document.body.style.overflow = "";
    document.body.style.userSelect = "";
  }
  clearDragState();
  window.removeEventListener("keydown", onKeydown);
});
</script>

<template>
  <div
    v-if="modelValue"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6"
    @click.self="closeOnBackdrop ? cancel() : undefined"
  >
    <section
      ref="dialogRef"
      :aria-label="ariaLabel || title || 'Dialog'"
      aria-modal="true"
      class="flex max-h-[calc(100dvh-3rem)] w-full flex-col overflow-hidden rounded-lg border border-border-default bg-surface-panel text-text-primary shadow-2xl outline-none"
      :class="[usesFloatingFrame ? 'absolute max-w-none' : sizeClass, movable ? 'touch-none' : '']"
      role="dialog"
      :style="dialogStyle"
      tabindex="-1"
    >
      <header
        class="flex min-h-11 shrink-0 items-center justify-between gap-3 border-b border-border-default bg-surface-sidebar px-4"
        :class="{ 'cursor-move select-none': movable }"
        @pointerdown="startInteraction($event, 'move')"
      >
        <div class="min-w-0">
          <slot name="header">
            <h2 v-if="title" class="truncate text-ui font-medium text-text-secondary">{{ title }}</h2>
          </slot>
        </div>
        <button class="btn btn-ghost" type="button" @click.stop="cancel" @pointerdown.stop>
          Close
        </button>
      </header>

      <div class="scrollbar-thin min-h-0 flex-1 overflow-auto p-4">
        <slot />
      </div>

      <footer v-if="$slots.footer" class="flex shrink-0 items-center justify-end gap-2 border-t border-border-default bg-surface-sidebar p-4">
        <slot name="footer" />
      </footer>

      <button
        v-if="resizable"
        aria-label="Resize dialog"
        class="absolute bottom-1 right-1 h-4 w-4 cursor-nwse-resize rounded-sm border-b-2 border-r-2 border-border-strong bg-transparent"
        type="button"
        @pointerdown.stop="startInteraction($event, 'resize')"
      />
    </section>
  </div>
</template>
