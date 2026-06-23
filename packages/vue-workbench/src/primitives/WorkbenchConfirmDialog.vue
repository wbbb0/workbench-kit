<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import WorkbenchDialog from "./WorkbenchDialog.vue";

const props = withDefaults(defineProps<{
  modelValue: boolean;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  acceptKeyboardConfirm?: boolean;
  autoConfirmAfterMs?: number;
  confirmVariant?: "primary" | "danger";
}>(), {
  title: "Please confirm",
  message: "",
  confirmText: "Confirm",
  cancelText: "Cancel",
  acceptKeyboardConfirm: true,
  autoConfirmAfterMs: 0,
  confirmVariant: "primary"
});

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  cancel: [];
  confirm: [];
}>();

let timer: number | null = null;
const remainingSeconds = ref(0);

const displayedConfirmText = computed(() => {
  if (!props.modelValue || remainingSeconds.value <= 0) {
    return props.confirmText;
  }
  return `${props.confirmText} (${remainingSeconds.value})`;
});

const confirmClass = computed(() => (
  props.confirmVariant === "danger" ? "btn btn-danger" : "btn btn-primary"
));

function clearTimer() {
  if (timer !== null) {
    window.clearInterval(timer);
    timer = null;
  }
  remainingSeconds.value = 0;
}

function confirm() {
  clearTimer();
  emit("confirm");
}

function cancel() {
  clearTimer();
  emit("cancel");
}

function startTimer() {
  clearTimer();

  if (!props.modelValue || props.autoConfirmAfterMs <= 0 || typeof window === "undefined") {
    return;
  }

  const deadline = Date.now() + props.autoConfirmAfterMs;
  const tick = () => {
    const remainingMs = deadline - Date.now();
    remainingSeconds.value = Math.max(0, Math.ceil(remainingMs / 1000));
    if (remainingMs <= 0) {
      confirm();
    }
  };

  tick();
  timer = window.setInterval(tick, 250);
}

watch(
  () => [props.modelValue, props.autoConfirmAfterMs] as const,
  startTimer,
  { immediate: true }
);

onBeforeUnmount(clearTimer);
</script>

<template>
  <WorkbenchDialog
    :accept-keyboard-confirm="acceptKeyboardConfirm"
    :model-value="modelValue"
    size="md"
    :title="title"
    @cancel="cancel"
    @close="cancel"
    @confirm="confirm"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <p class="whitespace-pre-line text-small leading-5 text-text-secondary">
      <slot>{{ message }}</slot>
    </p>

    <template #footer>
      <button class="btn btn-secondary max-w-full whitespace-normal text-left" type="button" @click="cancel">
        {{ cancelText }}
      </button>
      <button :class="confirmClass" class="max-w-full whitespace-normal text-left" type="button" @click="confirm">
        {{ displayedConfirmText }}
      </button>
    </template>
  </WorkbenchDialog>
</template>
