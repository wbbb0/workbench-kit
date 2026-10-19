<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { EditorOption, EditorOptionGroup } from "../types.js";
import { deepEqual } from "../editorState.js";
import { useResourceEditorOptions } from "../resourceEditorClient.js";

const props = defineProps<{
  dynamicRef: string;
  modelValue: unknown;
  effectiveValue?: unknown;
  inherited?: unknown;
  defaultValue?: unknown;
  disabled?: boolean;
  readOnly?: boolean;
}>();

const emit = defineEmits<{ "update:modelValue": [value: unknown] }>();

const options = useResourceEditorOptions(() => props.dynamicRef);
const groups = computed(() => options.data.value && "groups" in options.data.value ? options.data.value.groups : null);
const loadError = computed(() => options.error.value || (options.data.value !== null && !("groups" in options.data.value)));
const selectedGroupKey = ref("");
const selectedOptionKey = ref("");
const choosingGroup = ref(false);

const displayedValue = computed(() => {
  if (props.modelValue !== undefined) return props.modelValue;
  if (props.effectiveValue !== undefined) return props.effectiveValue;
  if (props.inherited !== undefined) return props.inherited;
  return props.defaultValue;
});

const selectedGroup = computed(() =>
  groups.value?.find((group) => group.key === selectedGroupKey.value)
);

const selectedOption = computed(() =>
  selectedGroup.value?.options.find((option) => option.key === selectedOptionKey.value)
);

const matchedSelection = computed(() => findSelection(displayedValue.value));
const hasInvalidValue = computed(() =>
  groups.value !== null
  && displayedValue.value !== undefined
  && matchedSelection.value === null
);
const interactionsDisabled = computed(() => props.disabled || props.readOnly);

watch(groups, () => {
  if (!groups.value) return;
  if (choosingGroup.value && groups.value.some(group => group.key === selectedGroupKey.value)) return;
  choosingGroup.value = false;
  syncFromValue(displayedValue.value);
});

watch(displayedValue, (value, previous) => {
  // Deep watchers receive the same reference for in-place parent mutations.
  if (value !== previous && deepEqual(value, previous)) return;
  choosingGroup.value = false;
  syncFromValue(value);
}, { deep: true });

function findSelection(value: unknown): { group: EditorOptionGroup; option: EditorOption } | null {
  if (!groups.value) return null;
  for (const group of groups.value) {
    const option = group.options.find((candidate) => deepEqual(candidate.value, value));
    if (option) return { group, option };
  }
  return null;
}

function syncFromValue(value: unknown) {
  if (!groups.value) return;
  const selection = findSelection(value);
  selectedGroupKey.value = selection?.group.key ?? "";
  selectedOptionKey.value = selection?.option.key ?? "";
}

function onGroupChange(event: Event) {
  if (interactionsDisabled.value) return;
  const nextGroupKey = (event.target as HTMLSelectElement).value;
  const previousOptionKey = selectedOptionKey.value;
  selectedGroupKey.value = nextGroupKey;

  const nextGroup = groups.value?.find((group) => group.key === nextGroupKey);
  const matchingOption = nextGroup?.options.find((option) =>
    option.key === previousOptionKey && !option.disabled
  );
  if (matchingOption) {
    selectedOptionKey.value = matchingOption.key;
    choosingGroup.value = false;
    emit("update:modelValue", matchingOption.value);
    return;
  }

  selectedOptionKey.value = "";
  choosingGroup.value = true;
}

function onOptionChange(event: Event) {
  if (interactionsDisabled.value) return;
  const optionKey = (event.target as HTMLSelectElement).value;
  const option = selectedGroup.value?.options.find((candidate) => candidate.key === optionKey);
  if (!option || option.disabled) return;
  selectedOptionKey.value = optionKey;
  choosingGroup.value = false;
  emit("update:modelValue", option.value);
}

function formatInvalidValue(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
</script>

<template>
  <div class="flex min-w-0 flex-col gap-1 py-1">
    <span v-if="groups === null && !loadError" class="text-xs italic text-text-muted">加载中…</span>
    <span v-else-if="loadError" class="text-xs text-danger">选项加载失败</span>
    <template v-else>
      <div class="flex min-w-0 flex-wrap items-center gap-1.5">
        <select
          aria-label="选项分组"
          class="input-base h-7 min-w-32 max-w-60 px-1.5 py-0.5"
          :value="selectedGroupKey"
          :disabled="interactionsDisabled"
          @change="onGroupChange"
        >
          <option value="" disabled>选择分组</option>
          <option v-for="group in groups" :key="group.key" :value="group.key">
            {{ group.label }}
          </option>
        </select>
        <select
          aria-label="分组选项"
          class="input-base h-7 min-w-40 max-w-80 px-1.5 py-0.5"
          :value="selectedOptionKey"
          :disabled="interactionsDisabled || !selectedGroup || selectedGroup.options.length === 0"
          @change="onOptionChange"
        >
          <option value="" disabled>选择选项</option>
          <option
            v-for="option in selectedGroup?.options ?? []"
            :key="option.key"
            :value="option.key"
            :disabled="option.disabled"
            :title="option.description"
          >
            {{ option.label }}
          </option>
        </select>
      </div>
      <span v-if="choosingGroup && !selectedOptionKey" class="text-xs text-text-muted">请选择该分组中的选项，选齐后才会替换当前值。</span>
      <span v-if="selectedOption?.description" class="text-xs text-text-muted">
        {{ selectedOption.description }}
      </span>
      <span v-if="hasInvalidValue" class="text-xs text-orange-400">
        当前值不在选项清单中：<code class="font-mono">{{ formatInvalidValue(displayedValue) }}</code>
      </span>
    </template>
  </div>
</template>
