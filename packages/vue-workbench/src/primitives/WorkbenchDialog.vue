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
}>(), {
  title: "",
  size: "md",
  acceptKeyboardConfirm: false,
  closeOnBackdrop: true,
  closeOnEscape: true,
  ariaLabel: ""
});

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  close: [];
  cancel: [];
  confirm: [];
}>();

const dialogRef = ref<HTMLElement | null>(null);

const sizeClass = computed(() => ({
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
  full: "max-w-[calc(100vw-2rem)]"
}[props.size]));

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

watch(
  () => props.modelValue,
  async (open) => {
    if (typeof document === "undefined") {
      return;
    }

    document.body.style.overflow = open ? "hidden" : "";

    if (open) {
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
  }
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
      :class="sizeClass"
      role="dialog"
      tabindex="-1"
    >
      <header class="flex min-h-11 shrink-0 items-center justify-between gap-3 border-b border-border-default bg-surface-sidebar px-4">
        <div class="min-w-0">
          <slot name="header">
            <h2 v-if="title" class="truncate text-ui font-medium text-text-secondary">{{ title }}</h2>
          </slot>
        </div>
        <button class="btn btn-ghost" type="button" @click="cancel">
          Close
        </button>
      </header>

      <div class="scrollbar-thin min-h-0 flex-1 overflow-auto p-4">
        <slot />
      </div>

      <footer v-if="$slots.footer" class="flex shrink-0 items-center justify-end gap-2 border-t border-border-default bg-surface-sidebar p-4">
        <slot name="footer" />
      </footer>
    </section>
  </div>
</template>
