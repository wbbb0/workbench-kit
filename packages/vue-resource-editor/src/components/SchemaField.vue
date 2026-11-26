<script setup lang="ts">
/**
 * Renders a single leaf field based on schema kind.
 * Emits "update" with the new value whenever the user changes the input.
 */
import { computed } from "vue";
import SchemaNumberInput from "./SchemaNumberInput.vue";
import SchemaSecretInput from "./SchemaSecretInput.vue";
import type { SchemaMeta } from "../types";
import { useResourceEditorOptions } from "../resourceEditorClient";

const props = defineProps<{
  schema: SchemaMeta;
  inputId?: string;
  singleLine?: boolean;
  modelValue: unknown;
  inherited?: unknown; // read-only value from parent layers
  defaultValue?: unknown;
  disabled?: boolean;
  readOnly?: boolean;
  /** 页面编辑缓冲保留无效/未完成数值输入，由宿主校验。 */
  preserveRawNumber?: boolean;
  defaultPresentation?: "value" | "placeholder";
}>();

const emit = defineEmits<{ "update:modelValue": [value: unknown] }>();

const options = useResourceEditorOptions(() =>
  props.schema.kind === "string" ? props.schema.dynamicRef : undefined,
);
const dynamicOptions = computed(() =>
  options.data.value && "options" in options.data.value
    ? options.data.value.options
    : null,
);
const dynamicOptionsError = computed(
  () =>
    options.error.value ||
    (options.data.value !== null && !("options" in options.data.value)),
);
const displayedValue = computed(() => {
  if (props.modelValue !== undefined) {
    return props.modelValue;
  }
  if (props.defaultPresentation === "placeholder") return undefined;
  if (props.inherited !== undefined) {
    return props.inherited;
  }
  return props.defaultValue;
});

const placeholder = computed(() => {
  const value = props.inherited ?? props.defaultValue;
  if (value === undefined || value === null) return "未设置";
  if (typeof value === "boolean") return value ? "开启" : "关闭";
  return String(value) || "空";
});
function onInput(e: Event) {
  const v = (e.target as HTMLInputElement).value;
  if (props.schema.kind === "number" && !props.preserveRawNumber) {
    const n = props.schema.integer ? parseInt(v, 10) : parseFloat(v);
    emit("update:modelValue", isNaN(n) ? null : n);
  } else {
    emit("update:modelValue", v);
  }
}

function onBoolChange(e: Event) {
  emit("update:modelValue", (e.target as HTMLInputElement).checked);
}

function onEnumChange(e: Event) {
  emit("update:modelValue", (e.target as HTMLSelectElement).value);
}

function onDynamicRefChange(e: Event) {
  const value = (e.target as HTMLSelectElement).value;
  emit("update:modelValue", value || undefined);
}

function toggleEnumValue(value: unknown, checked: boolean) {
  const selected = new Set(
    Array.isArray(displayedValue.value) ? displayedValue.value : [],
  );
  if (checked) selected.add(value);
  else selected.delete(value);
  emit("update:modelValue", [
    ...(props.schema.values ?? []).filter((item) => selected.has(item)),
    ...[...selected].filter(
      (item) => !(props.schema.values ?? []).includes(item),
    ),
  ]);
}
function currentStringValue(): string {
  return displayedValue.value !== undefined ? String(displayedValue.value) : "";
}

function onJsonInput(event: Event) {
  try {
    emit(
      "update:modelValue",
      JSON.parse((event.target as HTMLTextAreaElement).value),
    );
  } catch {
    // Keep the previous valid value while the user is editing invalid JSON.
  }
}

const readOnlyText = computed(() => {
  const value = displayedValue.value;
  if (value === undefined) return "-";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || value === null)
    return String(value);
  return JSON.stringify(value, null, 2);
});

const readOnlyMultiline = computed(() => {
  const value = displayedValue.value;
  return (
    (value != null && typeof value === "object") ||
    readOnlyText.value.includes("\n") ||
    readOnlyText.value.length > 120
  );
});
</script>

<template>
  <SchemaSecretInput
    v-if="schema.secret"
    :input-id="inputId"
    :model-value="displayedValue"
    :disabled="disabled"
    :read-only="readOnly"
    @update:model-value="emit('update:modelValue', $event)"
  />

  <template v-else-if="readOnly">
    <pre
      v-if="readOnlyMultiline"
      class="scrollbar-thin m-0 max-h-80 overflow-auto rounded border border-border-subtle bg-surface-muted px-2 py-1.5 font-mono text-mono leading-5 text-text-primary whitespace-pre-wrap wrap-break-word"
      >{{ readOnlyText }}</pre
    >
    <span
      v-else
      class="font-mono text-mono leading-5 wrap-break-word"
      :class="
        displayedValue === undefined ? 'text-text-subtle' : 'text-text-primary'
      "
      >{{ readOnlyText }}</span
    >
  </template>

  <!-- boolean -->
  <label
    v-else-if="schema.kind === 'boolean'"
    class="flex cursor-pointer items-center gap-1.5 rounded-md"
  >
    <input
      :id="inputId"
      type="checkbox"
      class="cursor-pointer accent-accent"
      :checked="displayedValue === true"
      :indeterminate="
        defaultPresentation === 'placeholder' && displayedValue === undefined
      "
      :title="displayedValue === undefined ? placeholder : undefined"
      :disabled="disabled"
      @change="onBoolChange"
    />
    <span class="text-ui text-text-primary">{{
      defaultPresentation === "placeholder"
        ? displayedValue === undefined
          ? placeholder
          : displayedValue
            ? "开启"
            : "关闭"
        : displayedValue
    }}</span>
  </label>

  <fieldset
    v-else-if="schema.kind === 'enum-set'"
    :id="inputId"
    class="flex flex-wrap gap-x-3 gap-y-2"
    :disabled="disabled"
  >
    <span v-if="displayedValue === undefined" class="text-text-muted"
      >未知</span
    >
    <label
      v-for="value in schema.values"
      :key="String(value)"
      class="flex cursor-pointer items-center gap-1.5"
    >
      <input
        type="checkbox"
        :value="String(value)"
        :checked="
          Array.isArray(displayedValue) && displayedValue.includes(value)
        "
        @change="
          toggleEnumValue(value, ($event.target as HTMLInputElement).checked)
        "
      />
      <span>{{ schema.valueLabels?.[String(value)] ?? value }}</span>
    </label>
    <label
      v-for="value in (Array.isArray(displayedValue)
        ? displayedValue
        : []
      ).filter((item) => !(schema.values ?? []).includes(item))"
      :key="String(value)"
      class="flex items-center gap-1.5"
    >
      <input
        type="checkbox"
        checked
        :value="String(value)"
        @change="
          toggleEnumValue(value, ($event.target as HTMLInputElement).checked)
        "
      />
      <span>{{ value }}（不支持）</span>
    </label>
  </fieldset>
  <!-- enum -->
  <select
    :id="inputId"
    v-else-if="schema.kind === 'enum'"
    class="input-base h-6 max-w-60 px-1.5 py-0.5"
    :value="displayedValue !== undefined ? String(displayedValue) : ''"
    :placeholder="
      defaultPresentation === 'placeholder' ? placeholder : undefined
    "
    :disabled="disabled"
    @change="onEnumChange"
  >
    <option v-if="defaultPresentation === 'placeholder'" value="">
      {{ placeholder }}
    </option>
    <option
      v-if="
        displayedValue !== undefined &&
        !(schema.values ?? []).includes(displayedValue)
      "
      :value="String(displayedValue)"
      disabled
    >
      {{ displayedValue }}（不支持）
    </option>
    <option
      v-for="opt in schema.values"
      :key="String(opt)"
      :value="String(opt)"
    >
      {{ schema.valueLabels?.[String(opt)] ?? opt }}
    </option>
  </select>

  <!-- literal (read-only display) -->
  <span
    v-else-if="schema.kind === 'literal'"
    class="font-mono text-mono text-text-muted"
    >{{ schema.value }}</span
  >

  <!-- 数值、滑条与时长使用同一输入语义。 -->
  <SchemaNumberInput
    v-else-if="schema.kind === 'number'"
    :schema="schema"
    :input-id="inputId"
    :model-value="displayedValue"
    :default-value="inherited ?? defaultValue"
    :placeholder="
      defaultPresentation === 'placeholder' ? placeholder : undefined
    "
    :disabled="disabled"
    :preserve-raw-number="preserveRawNumber"
    @update:model-value="emit('update:modelValue', $event)"
  />

  <!-- string with dynamicRef — dropdown populated from API -->
  <template v-else-if="schema.kind === 'string' && schema.dynamicRef">
    <select
      :id="inputId"
      v-if="dynamicOptions !== null && !dynamicOptionsError"
      class="input-base h-6 max-w-60 px-1.5 py-0.5"
      :value="currentStringValue()"
      :disabled="disabled"
      @change="onDynamicRefChange"
    >
      <option
        v-if="!schema.optional && !currentStringValue()"
        value=""
        disabled
      >
        请选择
      </option>
      <option v-if="schema.optional" value="">—</option>
      <option v-for="opt in dynamicOptions" :key="opt" :value="opt">
        {{ opt }}
      </option>
    </select>
    <span v-else-if="dynamicOptionsError" class="text-ui text-text-muted">
      <textarea
        :id="inputId"
        class="input-base min-h-7 w-full max-w-120 resize-y text-ui leading-[1.4]"
        :value="currentStringValue()"
        :disabled="disabled"
        rows="2"
        @input="onInput"
      />
    </span>
    <span v-else class="text-ui text-text-muted italic text-xs">加载中…</span>
    <span
      v-if="
        dynamicOptions !== null &&
        currentStringValue() &&
        !dynamicOptions.includes(currentStringValue())
      "
      class="ml-1 text-xs text-warning"
      >不在清单中</span
    >
  </template>

  <input
    v-else-if="schema.kind === 'string' && (singleLine || !!schema.format)"
    :id="inputId"
    :type="
      (
        {
          'http-url': 'url',
          url: 'url',
          email: 'email',
          date: 'date',
          time: 'time',
          'date-time': 'datetime-local',
          'datetime-local': 'datetime-local',
        } as Record<string, string>
      )[schema.format ?? ''] || 'text'
    "
    :step="schema.step"
    class="input-base w-full px-2 py-1"
    :value="displayedValue ?? ''"
    :placeholder="
      defaultPresentation === 'placeholder' ? placeholder : undefined
    "
    :disabled="disabled"
    @input="onInput"
  />

  <!-- string / null / unknown — textarea for multi-line, input for short -->
  <textarea
    :id="inputId"
    v-else-if="schema.kind === 'string'"
    class="input-base min-h-7 w-full max-w-120 resize-y text-ui leading-[1.4]"
    :value="displayedValue !== undefined ? String(displayedValue) : ''"
    :placeholder="
      defaultPresentation === 'placeholder' ? placeholder : undefined
    "
    :disabled="disabled"
    rows="2"
    @input="onInput"
  />

  <!-- fallback: JSON text -->
  <textarea
    :id="inputId"
    v-else
    class="input-base min-h-7 w-full max-w-120 resize-y font-mono text-ui leading-[1.4]"
    :value="JSON.stringify(displayedValue, null, 2)"
    :disabled="disabled"
    rows="3"
    @input="onJsonInput"
  />
</template>
