<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import type { WorkbenchMultiSelectOption } from "./multiSelectTypes";

const props = withDefaults(defineProps<{
  modelValue: readonly string[];
  options: readonly WorkbenchMultiSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  menuClass?: string;
}>(), {
  placeholder: "Select options",
  searchPlaceholder: "Search",
  emptyMessage: "No options",
  disabled: false,
  menuClass: ""
});

const emit = defineEmits<{
  "update:modelValue": [value: string[]];
}>();

const rootRef = ref<HTMLElement | null>(null);
const open = ref(false);
const search = ref("");

const normalizedOptions = computed(() => props.options.map((option) => {
  if (typeof option === "string") {
    return {
      value: option,
      label: option,
      description: "",
      disabled: false
    };
  }

  return {
    value: option.value,
    label: option.label ?? option.value,
    description: option.description ?? "",
    disabled: option.disabled === true
  };
}));

const selectedSet = computed(() => new Set(props.modelValue));

const selectedLabels = computed(() => {
  const labelByValue = new Map(normalizedOptions.value.map((option) => [option.value, option.label]));
  return props.modelValue.map((value) => labelByValue.get(value) ?? value);
});

const buttonLabel = computed(() => (
  selectedLabels.value.length ? selectedLabels.value.join(", ") : props.placeholder
));

const filteredOptions = computed(() => {
  const query = search.value.trim().toLowerCase();
  if (!query) {
    return normalizedOptions.value;
  }

  return normalizedOptions.value.filter((option) => (
    option.label.toLowerCase().includes(query)
    || option.value.toLowerCase().includes(query)
    || option.description.toLowerCase().includes(query)
  ));
});

function toggleOpen() {
  if (props.disabled) {
    return;
  }
  open.value = !open.value;
}

function setSelected(value: string, selected: boolean) {
  const next = new Set(props.modelValue);
  if (selected) {
    next.add(value);
  } else {
    next.delete(value);
  }
  emit("update:modelValue", [...next]);
}

function onDocumentClick(event: MouseEvent) {
  if (!rootRef.value || !(event.target instanceof Node)) {
    return;
  }
  if (!rootRef.value.contains(event.target)) {
    open.value = false;
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    open.value = false;
  }
}

onMounted(() => {
  document.addEventListener("click", onDocumentClick);
  window.addEventListener("keydown", onKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener("click", onDocumentClick);
  window.removeEventListener("keydown", onKeydown);
});
</script>

<template>
  <div ref="rootRef" class="relative min-w-0" :class="{ 'pointer-events-none opacity-60': disabled }">
    <button
      class="input-base flex min-h-8 items-center justify-between gap-2 text-left"
      type="button"
      :aria-expanded="open"
      :disabled="disabled"
      @click="toggleOpen"
    >
      <span class="min-w-0 flex-1 truncate" :class="selectedLabels.length ? 'text-text-primary' : 'text-text-subtle'">
        {{ buttonLabel }}
      </span>
      <span class="shrink-0 text-text-subtle" aria-hidden="true">{{ open ? "▴" : "▾" }}</span>
    </button>

    <div
      v-if="open"
      class="absolute left-0 right-0 z-50 mt-1 rounded-lg border border-border-default bg-surface-panel p-2 shadow-2xl"
      :class="menuClass"
    >
      <input
        v-model="search"
        class="input-base min-h-8"
        :placeholder="searchPlaceholder"
        type="search"
      />

      <div class="scrollbar-thin mt-2 flex max-h-60 flex-col gap-1 overflow-auto">
        <label
          v-for="option in filteredOptions"
          :key="option.value"
          class="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-small text-text-secondary hover:bg-surface-hover"
          :class="{ 'cursor-not-allowed opacity-55': option.disabled }"
        >
          <input
            class="mt-0.5"
            type="checkbox"
            :checked="selectedSet.has(option.value)"
            :disabled="option.disabled"
            @change="setSelected(option.value, ($event.target as HTMLInputElement).checked)"
          />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-text-secondary">{{ option.label }}</span>
            <span v-if="option.description" class="block truncate text-text-subtle">{{ option.description }}</span>
          </span>
        </label>

        <div v-if="filteredOptions.length === 0" class="px-2 py-3 text-center text-small text-text-subtle">
          {{ emptyMessage }}
        </div>
      </div>
    </div>
  </div>
</template>

