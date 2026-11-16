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
  closeText?: string;
  trapFocus?: boolean;
}>(), {
  title: "",
  size: "md",
  acceptKeyboardConfirm: false,
  closeOnBackdrop: true,
  closeOnEscape: true,
  ariaLabel: "",
  closeText: "Close",
  trapFocus: false
});

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  close: [];
  cancel: [];
  confirm: [];
}>();

const dialogRef = ref<HTMLElement | null>(null);
let locked = false;
let previousOverflow = "";
function releaseScroll() {
  if (!locked || typeof document === "undefined") return;
  document.body.style.overflow = previousOverflow;
  locked = false;
}

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

  if (event.key === "Tab" && props.trapFocus && dialogRef.value) {
    const panel = dialogRef.value;
    const controls = Array.from(panel.querySelectorAll<HTMLElement>(
      'a[href],button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex]'
    )).filter(element => element.tabIndex >= 0 && !element.closest('[hidden],[inert]') && getComputedStyle(element).display !== 'none');
    const first = controls[0], last = controls.at(-1), active = document.activeElement;
    if (!first) { event.preventDefault(); panel.focus(); }
    else if (event.shiftKey && (active === first || active === panel || !panel.contains(active))) {
      event.preventDefault(); last?.focus();
    } else if (!event.shiftKey && (active === last || active === panel || !panel.contains(active))) {
      event.preventDefault(); first.focus();
    }
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

    if (open && !locked) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      locked = true;
    } else if (!open) releaseScroll();

    if (open) {
      await nextTick();
      if (props.modelValue) dialogRef.value?.focus();
    }
  },
  { immediate: true }
);

onMounted(() => {
  window.addEventListener("keydown", onKeydown);
});

onBeforeUnmount(() => {
  releaseScroll();
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
          {{ closeText }}
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
