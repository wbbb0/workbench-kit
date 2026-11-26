<script setup lang="ts">
import type { Component } from "vue";
import { ChevronRight } from "lucide-vue-next";
import { useDefaultWorkbenchSelectionNavigation } from "../runtime/workbenchAreaContext.js";

const props = withDefaults(defineProps<{
  selected?: boolean;
  title?: string;
  subtitle?: string | null;
  meta?: string | number | null;
  dense?: boolean;
  multiline?: boolean;
  divided?: boolean;
  disabled?: boolean;
  icon?: Component;
  iconClass?: string;
  disclosure?: boolean;
  ariaCurrent?: "page" | "step" | "location" | "date" | "time" | "true" | boolean;
  navigate?: boolean;
}>(), {
  selected: false,
  title: "",
  subtitle: null,
  meta: null,
  dense: false,
  multiline: false,
  divided: true,
  disabled: false,
  icon: undefined,
  iconClass: undefined,
  disclosure: false,
  ariaCurrent: undefined,
  navigate: true,
});

const emit = defineEmits<{
  select: [];
}>();

const navigateAfterSelection = useDefaultWorkbenchSelectionNavigation();

function select() {
  if (props.disabled) {
    return;
  }
  emit("select");
  if (props.navigate) {
    navigateAfterSelection();
  }
}
</script>

<template>
  <button
    class="list-row flex w-full justify-between gap-3 text-left disabled:cursor-not-allowed disabled:opacity-50"
    :class="[
      selected ? 'is-selected' : '',
      divided ? 'border-b border-border-default' : '',
      dense ? 'px-3 py-2' : 'px-3 py-3',
      multiline ? 'items-start' : 'items-center',
    ]"
    type="button"
    :disabled="disabled"
    :aria-current="ariaCurrent === true ? 'true' : ariaCurrent || undefined"
    @click="select"
  >
    <slot name="leading">
      <component
        :is="icon"
        v-if="icon"
        :size="16"
        class="shrink-0"
        :class="iconClass || (selected ? 'text-accent' : 'text-text-muted')"
        aria-hidden="true"
      />
    </slot>
    <div class="min-w-0 flex-1">
      <slot>
        <div
          class="text-ui text-text-secondary"
          :class="multiline ? 'whitespace-normal wrap-break-word' : 'truncate'"
        >{{ title }}</div>
        <div
          v-if="subtitle"
          class="text-small text-text-subtle"
          :class="multiline ? 'whitespace-normal wrap-break-word' : 'truncate'"
        >{{ subtitle }}</div>
      </slot>
    </div>
    <slot name="trailing">
      <div
        v-if="(meta !== null && meta !== undefined && meta !== '') || disclosure"
        class="flex shrink-0 items-center gap-1.5"
      >
        <span
          v-if="meta !== null && meta !== undefined && meta !== ''"
          class="px-1.5 text-small text-text-subtle"
        >{{ meta }}</span>
        <ChevronRight
          v-if="disclosure"
          :size="15"
          class="shrink-0 text-text-muted"
          aria-hidden="true"
        />
      </div>
    </slot>
  </button>
</template>
