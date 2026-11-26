<script setup lang="ts">
import {
  computed,
  ref,
  nextTick,
  watch,
  useId,
  onActivated,
  onMounted,
} from "vue";
import {
  applyVariantChange,
  evaluateSchemaPreview,
  isObjectToggleActive,
  ownProperty,
  resolveObjectFields,
  resolveObjectVariantMeta,
} from "@workbench-kit/schema";
import {
  ChevronRight,
  ArrowLeft,
  Plus,
  Trash2,
  RotateCcw,
  ArrowUp,
  ArrowDown,
} from "lucide-vue-next";
import {
  WorkbenchBreadcrumbs,
  WorkbenchButton,
  WorkbenchIconButton,
} from "@workbench-kit/vue-workbench";
import {
  createSettingsPageState,
  type SettingsPageState,
} from "../settingsPageState";
import SchemaField from "./SchemaField.vue";
import SchemaSecretInput from "./SchemaSecretInput.vue";
import type { SchemaMeta } from "../types";
import {
  initialSettingValue,
  settingAt,
  settingBranch,
  settingKey,
  settingValue,
  searchSettings,
  resolveSettingsPage,
  isSettingPage,
  type SettingsStructureEdit,
} from "../settingsPages";

const props = withDefaults(
  defineProps<{
    schema: SchemaMeta;
    /** 宿主为具体字段提供过滤、排序后的引用选项；地址使用 settingKey。 */
    referenceOptions?: Record<
      string,
      { value: string; label?: string; group?: string }[]
    >;
    values: Record<string, unknown>;
    overrides: Record<string, unknown>;
    path: string[];
    secrets?: Record<string, boolean>;
    secretInputs?: Record<string, string>;
    issues?: { path: string[]; message: string }[];
    disabled?: boolean;
    showHeader?: boolean;
    searchEnabled?: boolean;
    defaultsAsPlaceholders?: boolean;
    showBackButton?: boolean;
    showBreadcrumbs?: boolean;
    showTitle?: boolean;
    focusPath?: string[];
    pageState?: SettingsPageState;
    selectedPath?: string[];
    returnPath?: string[];
    structurePending?: boolean;
    applyStructure?: (edit: SettingsStructureEdit) => Promise<boolean>;
  }>(),
  {
    showHeader: true,
    searchEnabled: true,
    defaultsAsPlaceholders: false,
    showBackButton: true,
    showBreadcrumbs: true,
    showTitle: true,
  },
);
const emit = defineEmits<{
  navigate: [path: string[]];
  edit: [path: string[], value: unknown];
  reset: [path: string[]];
  secretInput: [path: string[], value: string];
  secret: [path: string[], action: "set" | "clear", value?: string];
  rename: [path: string[], name: string];
}>();

const ui = props.pageState ?? createSettingsPageState();
const query = computed({
  get: () => ui.query,
  set: (value) => {
    ui.query = value;
  },
});
const content = ref<HTMLElement>();
const idPrefix = useId();
const fieldId = (path: string[]) => idPrefix + "-setting-" + settingKey(path);
const positions = ui.positions;
function savePosition() {
  if (content.value)
    positions.set(settingKey(props.path), content.value.scrollTop);
}
async function restorePosition() {
  await nextTick();
  if (content.value)
    content.value.scrollTop = positions.get(settingKey(props.path)) ?? 0;
  focusField();
}
function focusField() {
  const path = props.focusPath ?? props.returnPath;
  if (!path || !content.value) return;
  const key = settingKey(path);
  const row = Array.from(
    content.value.querySelectorAll<HTMLElement>("[data-setting-path]"),
  ).find((element) => element.dataset.settingPath === key);
  const variant = content.value.querySelector<HTMLSelectElement>(
    "[data-setting-variant]",
  );
  const target =
    props.focusPath &&
    variant?.dataset.settingVariant === key &&
    (original.value?.discriminator || current.value?.variantBy || !row)
      ? variant
      : (row?.querySelector<HTMLElement>(
          props.returnPath && !props.focusPath
            ? "[data-setting-entry]"
            : "[id], [data-setting-entry]",
        ) ?? row);
  target?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  target?.focus({ preventScroll: true });
}
onMounted(restorePosition);
watch(
  () => [props.focusPath, props.returnPath],
  () => nextTick(focusField),
  { deep: true },
);
watch(
  () => settingKey(props.path),
  async (next, previous) => {
    if (content.value && previous)
      positions.set(previous, content.value.scrollTop);
    await nextTick();
    if (content.value) content.value.scrollTop = positions.get(next) ?? 0;
    focusField();
  },
);
onActivated(restorePosition);
const names = ui.names;
const error = ref("");
const structureError = ref("");
const original = computed(() =>
  settingAt(props.schema, props.values, props.path),
);
const current = computed(() =>
  original.value
    ? settingBranch(original.value, settingValue(props.values, props.path))
    : undefined,
);
const currentValue = computed(() => settingValue(props.values, props.path));
const parent = computed(() =>
  props.path.length
    ? settingAt(props.schema, props.values, props.path.slice(0, -1))
    : undefined,
);
const title = computed(() =>
  parent.value?.kind === "record"
    ? props.path.at(-1)
    : (original.value?.title ?? props.path.at(-1) ?? "设置"),
);

function toggleInfo(schema: SchemaMeta, path: string[]) {
  if (schema.kind !== "object" || !schema.toggleField) return undefined;
  const field = ownProperty(schema.fields, schema.toggleField);
  if (!field) return undefined;
  const value = settingValue(props.values, path);
  const override = settingValue(props.overrides, path);
  return {
    key: schema.toggleField,
    path: [...path, schema.toggleField],
    schema: field.schema,
    title: field.title ?? field.schema.title ?? schema.toggleField,
    active: isObjectToggleActive(schema, value, override),
  };
}

const currentToggle = computed(() =>
  current.value ? toggleInfo(current.value, props.path) : undefined,
);

const currentObjectVariant = computed(() => {
  const node = current.value;
  if (!node || (currentToggle.value && !currentToggle.value.active)) {
    return undefined;
  }
  return resolveObjectVariantMeta(node, currentValue.value);
});

type PageRow = {
  key: string;
  schema: SchemaMeta;
  path: string[];
  title: string;
  preview?: string;
  toggle?: ReturnType<typeof toggleInfo>;
  entry: boolean;
};

const rows = computed<PageRow[]>(() => {
  const node = current.value;
  if (!node) return [];
  if (currentToggle.value && !currentToggle.value.active) return [];
  if (node.kind === "array")
    return ((currentValue.value ?? []) as unknown[]).map((value, index) => {
      const itemSchema = node.item!;
      const preview = evaluateSchemaPreview(itemSchema, value);
      return {
        key: String(index),
        schema: itemSchema,
        path: [...props.path, String(index)],
        title: preview
          ? `${index + 1}. ${preview}`
          : `${index + 1}. ${itemSchema.title ?? "条目"}`,
        entry: true,
      };
    });
  if (node.kind === "record") {
    const recordObj = (currentValue.value ?? {}) as Record<string, unknown>;
    return Object.keys(recordObj).map((key) => {
      const preview = evaluateSchemaPreview(node.recordValue!, recordObj[key]);
      return {
        key,
        schema: node.recordValue!,
        path: [...props.path, key],
        title: key,
        ...(preview ? { preview } : {}),
        entry: true,
      };
    });
  }
  if (node.kind === "object") {
    if (node.variantBy && node.variants && node.optional && currentValue.value === undefined) {
      return [];
    }
    const fields = resolveObjectFields(node, currentValue.value);
    return Object.entries(fields)
      .filter(
        ([key]) =>
          key !== original.value?.discriminator &&
          key !== node.toggleField &&
          key !== node.variantBy,
      )
      .map(([key, field]) => {
        const childPath = [...props.path, key];
        const childValue = settingValue(props.values, childPath);
        const preview = isSettingPage(field.schema)
          ? evaluateSchemaPreview(field.schema, childValue)
          : "";
        const toggle = toggleInfo(field.schema, childPath);
        return {
          key,
          schema: field.schema,
          path: childPath,
          title: field.title ?? field.schema.title ?? key,
          ...(preview ? { preview } : {}),
          ...(toggle ? { toggle } : {}),
          entry: false,
        };
      });
  }
  return [
    {
      key: props.path.at(-1) ?? "value",
      schema: node,
      path: props.path,
      title: node.title ?? "值",
      entry: false,
    },
  ];
});
const results = computed(() =>
  searchSettings(props.schema, props.values, query.value),
);
const complex = isSettingPage;
const breadcrumbs = computed(() =>
  resolveSettingsPage(props.schema, props.values, props.path).pages.map(
    (page) => ({ label: page.title, onSelect: () => go(page.path) }),
  ),
);
const options = (schema: SchemaMeta, path: string[]) =>
  props.referenceOptions?.[settingKey(path)] ??
  props.referenceOptions?.[settingKey([...path.slice(0, -1), "*"])] ??
  Object.keys(
    (settingValue(props.values, schema.reference?.path ?? []) ?? {}) as object,
  ).map((value) => ({
    value,
    label: value,
    group: undefined as string | undefined,
  }));
const inlineField = (schema: SchemaMeta) =>
  schema.kind !== "string" || !!schema.reference || !!schema.format;
const inputValue = (path: string[]) =>
  settingValue(
    props.defaultsAsPlaceholders ? props.overrides : props.values,
    path,
  );
function placeholderFor(path: string[], schema: SchemaMeta) {
  const value =
    settingValue(props.overrides, path) === undefined
      ? (settingValue(props.values, path) ?? schema.defaultValue)
      : schema.defaultValue;
  return value;
}
function editField(path: string[], value: unknown) {
  if (props.defaultsAsPlaceholders && (value === "" || value === undefined))
    emit("reset", path);
  else emit("edit", path, value);
}
const issuesFor = (path: string[]) =>
  props.issues?.filter(
    (issue) => settingKey(issue.path) === settingKey(path),
  ) ?? [];
const go = (path: string[]) => {
  error.value = "";
  if (props.searchEnabled) query.value = "";
  emit("navigate", path);
};
function add() {
  const key = (names[settingKey(props.path)] ?? "").trim();
  if (!key || ["__proto__", "constructor", "prototype"].includes(key)) {
    error.value = "请输入有效的条目名称";
    return;
  }
  if (
    Object.hasOwn((settingValue(props.values, props.path) ?? {}) as object, key)
  ) {
    error.value = "名称已存在";
    return;
  }
  emit(
    "edit",
    [...props.path, key],
    initialSettingValue(current.value!.recordValue!),
  );
  names[settingKey(props.path)] = "";
  go([...props.path, key]);
}
async function applyStructure(edit: SettingsStructureEdit) {
  structureError.value = "";
  try {
    await props.applyStructure?.(edit);
  } catch (cause) {
    structureError.value = cause instanceof Error ? cause.message : String(cause);
  }
}
async function addArrayItem() {
  const value = initialSettingValue(current.value!.item!);
  if (props.applyStructure) {
    await applyStructure({
      type: "array",
      path: props.path,
      operation: "append",
      value,
    });
    return;
  }
  const items = [
    ...((settingValue(props.values, props.path) ?? []) as unknown[]),
  ];
  items.push(value);
  emit("edit", props.path, items);
  go([...props.path, String(items.length - 1)]);
}
function removeEntry(path: string[]) {
  if (current.value?.kind !== "array") {
    if (props.applyStructure) void applyStructure({ type: "reset", path });
    else emit("reset", path);
    return;
  }
  if (props.applyStructure) {
    void applyStructure({
      type: "array",
      path: props.path,
      operation: "remove",
      index: Number(path.at(-1)),
    });
    return;
  }
  const items = [
    ...((settingValue(props.values, props.path) ?? []) as unknown[]),
  ];
  items.splice(Number(path.at(-1)), 1);
  emit("edit", props.path, items);
}
function moveEntry(path: string[], offset: number) {
  const items = [
    ...((settingValue(props.values, props.path) ?? []) as unknown[]),
  ];
  const from = Number(path.at(-1)),
    to = from + offset;
  if (to < 0 || to >= items.length) return;
  if (props.applyStructure) {
    void applyStructure({
      type: "array",
      path: props.path,
      operation: "move",
      from,
      to,
    });
    return;
  }
  [items[from], items[to]] = [items[to], items[from]];
  emit("edit", props.path, items);
}
async function changeVariant(event: Event) {
  const select = event.target as HTMLSelectElement;
  const option = original.value?.options?.[Number(select.value)];
  if (!option) return;
  const value = initialSettingValue(option);
  if (!props.applyStructure) {
    emit("edit", props.path, value);
    return;
  }
  const currentIndex = () =>
    original.value?.options?.indexOf(current.value!) ?? -1;
  select.value = String(currentIndex());
  await applyStructure({ type: "set", path: props.path, value });
  await nextTick();
  select.value = String(currentIndex());
}
async function changeObjectVariant(event: Event) {
  const node = current.value;
  const variant = currentObjectVariant.value;
  if (!node || !variant) return;
  const select = event.target as HTMLSelectElement;
  const nextKey = select.value || undefined;
  const beforeKey = variant.currentKey ?? "";
  if (!props.applyStructure) {
    if (nextKey === undefined) {
      emit("reset", props.path);
    } else if (currentValue.value === undefined) {
      emit("edit", props.path, applyVariantChange(node, undefined, nextKey));
    } else {
      emit("edit", [...props.path, variant.key], nextKey);
    }
    return;
  }
  select.value = beforeKey;
  if (nextKey === undefined) {
    await applyStructure({ type: "reset", path: props.path });
  } else if (currentValue.value === undefined) {
    await applyStructure({
      type: "set",
      path: props.path,
      value: applyVariantChange(node, undefined, nextKey),
    });
  } else {
    await applyStructure({
      type: "set",
      path: [...props.path, variant.key],
      value: nextKey,
    });
  }
  await nextTick();
  select.value = currentObjectVariant.value?.currentKey ?? "";
}
</script>
<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <header
      v-if="showHeader"
      class="flex h-9 shrink-0 items-center gap-2 border-b border-border-default px-3"
    >
      <button
        v-if="showBackButton !== false && path.length"
        aria-label="返回上一级"
        title="返回上一级"
        @click="go(path.slice(0, -1))"
      >
        <ArrowLeft :size="16" />
      </button>
      <h2 v-if="showTitle !== false" class="min-w-0 flex-1 truncate text-sm">
        {{ title }}
      </h2>
      <input
        v-if="searchEnabled"
        v-model="query"
        aria-label="搜索设置"
        placeholder="搜索设置"
        class="min-w-0 border-0 bg-transparent text-xs outline-none"
        :class="showTitle === false ? 'w-full' : 'w-36'"
      />
    </header>
    <div ref="content" @scroll="savePosition" class="min-h-0 flex-1 overflow-auto">
      <p v-if="structureError" role="alert" class="p-3 text-sm text-danger">
        {{ structureError }}
      </p>
      <template v-if="searchEnabled && query.trim()">
        <button
          v-for="result in results"
          :key="settingKey(result.path)"
          class="flex w-full items-center justify-between border-b border-border-default px-4 py-3 text-left hover:bg-surface-hover"
          @click="go(result.path)"
        >
          <span
            >{{ result.title
            }}<small class="ml-3 text-text-muted">{{
              result.path.join(" / ")
            }}</small></span
          ><ChevronRight :size="16" />
        </button>
        <p v-if="!results.length" class="p-4 text-sm text-text-muted">
          没有匹配的设置
        </p>
      </template>
      <template v-else>
        <nav
          v-if="showBreadcrumbs !== false && path.length"
          aria-label="设置路径"
          class="border-b border-border-default px-3 py-2 text-xs text-text-muted"
        >
          <WorkbenchBreadcrumbs :items="breadcrumbs" auto-collapse />
        </nav>
        <p v-if="!current" class="p-4 text-sm text-text-muted">
          此设置已不存在。<button class="ml-2 text-accent" @click="go([])">
            返回设置
          </button>
        </p>
        <div
          v-if="parent?.kind === 'record' && current"
          class="flex items-center gap-2 border-b border-border-default p-3"
        >
          <input
            :value="names['rename:' + settingKey(path)] ?? path.at(-1)"
            aria-label="条目名称"
            class="input-base min-w-0 flex-1 px-2 py-1"
            :disabled="disabled"
            @input="
              names['rename:' + settingKey(path)] = (
                $event.target as HTMLInputElement
              ).value
            "
          />
          <WorkbenchButton
            label="重命名"
            size="sm"
            :disabled="disabled || structurePending"
            @click="
              emit(
                'rename',
                path,
                names['rename:' + settingKey(path)] ?? path.at(-1)!,
              )
            "
          />
        </div>
        <div
          v-if="currentToggle"
          :data-setting-path="settingKey(currentToggle.path)"
          tabindex="-1"
          class="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border-default px-3 py-2"
        >
          <label
            class="min-w-[min(100%,8rem)] flex-1 text-sm"
            :for="fieldId(currentToggle.path)"
            >{{ currentToggle.title }}</label
          >
          <WorkbenchIconButton
            :icon="RotateCcw"
            size="sm"
            variant="secondary"
            :title="'恢复默认 ' + currentToggle.title"
            class="order-2"
            :disabled="disabled"
            @click="emit('reset', currentToggle.path)"
          />
          <div class="order-1 w-56 min-w-[min(100%,8rem)] max-w-full shrink-0">
            <SchemaField
              :input-id="fieldId(currentToggle.path)"
              :schema="currentToggle.schema"
              :default-value="placeholderFor(currentToggle.path, currentToggle.schema)"
              :default-presentation="
                defaultsAsPlaceholders ? 'placeholder' : 'value'
              "
              :model-value="inputValue(currentToggle.path)"
              :disabled="disabled"
              single-line
              @update:model-value="editField(currentToggle.path, $event)"
            />
          </div>
          <p
            v-if="currentToggle.schema.description"
            class="order-4 basis-full text-xs text-text-muted"
          >
            {{ currentToggle.schema.description }}
          </p>
          <p
            v-for="issue in issuesFor(currentToggle.path)"
            :key="issue.message"
            role="alert"
            class="order-4 basis-full text-xs text-danger"
          >
            {{ issue.message }}
          </p>
        </div>
        <div
          v-if="original?.kind === 'union'"
          class="flex items-center gap-3 border-b border-border-default p-3"
        >
          <label class="text-sm">类型</label>
          <select
            aria-label="类型"
            :data-setting-variant="settingKey(path)"
            class="input-base min-w-0 flex-1 px-2 py-1"
            :value="original.options?.indexOf(current!)"
            :disabled="disabled || structurePending"
            @change="changeVariant"
          >
            <option
              v-for="(option, i) in original.options"
              :key="i"
              :value="i"
              :disabled="option.disabled"
            >
              {{ option.title ?? option.kind }}
            </option>
          </select>
        </div>
        <div
          v-else-if="currentObjectVariant"
          class="flex items-center gap-3 border-b border-border-default p-3"
        >
          <label class="text-sm">{{ currentObjectVariant.label }}</label>
          <select
            :aria-label="currentObjectVariant.label"
            :data-setting-variant="settingKey(path)"
            class="input-base min-w-0 flex-1 px-2 py-1"
            :value="currentObjectVariant.currentKey ?? ''"
            :disabled="disabled || structurePending"
            @change="changeObjectVariant"
          >
            <option v-if="currentObjectVariant.optional" value="">未设置</option>
            <option
              v-for="option in currentObjectVariant.options"
              :key="option.value"
              :value="option.value"
              :disabled="option.disabled"
            >
              {{ option.label }}
            </option>
          </select>
        </div>
        <div
          v-for="row in rows"
          :key="settingKey(row.path)"
          :data-setting-path="settingKey(row.path)"
          tabindex="-1"
          class="border-b border-border-default"
        >
          <div v-if="complex(row.schema)" class="flex items-center">
            <input
              v-if="row.toggle"
              type="checkbox"
              class="ml-3 shrink-0 cursor-pointer accent-accent"
              :aria-label="row.title + ' 开关'"
              :checked="
                defaultsAsPlaceholders
                  ? inputValue(row.toggle.path) === true
                  : row.toggle.active
              "
              :indeterminate="
                defaultsAsPlaceholders &&
                inputValue(row.toggle.path) === undefined
              "
              :title="row.toggle.title"
              :disabled="disabled"
              @change="
                editField(
                  row.toggle.path,
                  ($event.target as HTMLInputElement).checked,
                )
              "
            />
            <button
              class="flex min-w-0 flex-1 items-center justify-between gap-2 px-4 py-3 text-left text-sm enabled:hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
              data-setting-entry
              :disabled="row.toggle && !row.toggle.active"
              :class="{
                'bg-surface-selected':
                  selectedPath &&
                  settingKey(selectedPath) === settingKey(row.path),
              }"
              :aria-current="
                selectedPath &&
                settingKey(selectedPath) === settingKey(row.path)
                  ? 'true'
                  : undefined
              "
              @click="go(row.path)"
            >
              <span class="min-w-0 flex-1">
                <span class="block truncate">{{ row.title }}</span>
                <small
                  v-if="row.preview"
                  class="block truncate text-xs text-text-muted"
                  >{{ row.preview }}</small
                >
              </span>
              <ChevronRight :size="16" />
            </button>
            <template v-if="current?.kind === 'array'">
              <WorkbenchIconButton
                :icon="ArrowUp"
                title="上移条目"
                size="sm"
                :disabled="disabled || structurePending || row.key === '0'"
                @click="moveEntry(row.path, -1)"
              />
              <WorkbenchIconButton
                :icon="ArrowDown"
                title="下移条目"
                size="sm"
                :disabled="
                  disabled ||
                  structurePending ||
                  Number(row.key) === rows.length - 1
                "
                @click="moveEntry(row.path, 1)"
              />
            </template>
            <WorkbenchIconButton
              v-if="row.entry"
              :icon="Trash2"
              :title="'删除 ' + row.title"
              size="sm"
              variant="secondary"
              class="mr-3"
              :disabled="disabled || structurePending"
              @click="removeEntry(row.path)"
            />
          </div>
          <div
            v-else
            class="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2"
          >
            <label
              class="min-w-0 flex-1 text-sm"
              :class="inlineField(row.schema) ? 'min-w-[min(100%,8rem)]' : ''"
              :for="fieldId(row.path)"
              >{{ row.title }}</label
            >
            <span
              v-if="!defaultsAsPlaceholders && !row.schema.secret"
              class="text-xs text-text-muted"
              >{{
                settingValue(overrides, row.path) === undefined
                  ? "内置默认"
                  : "用户覆盖"
              }}</span
            >
            <template v-if="current?.kind === 'array'">
              <WorkbenchIconButton
                :icon="ArrowUp"
                title="上移条目"
                size="sm"
                :disabled="disabled || structurePending || row.key === '0'"
                @click="moveEntry(row.path, -1)"
              />
              <WorkbenchIconButton
                :icon="ArrowDown"
                title="下移条目"
                size="sm"
                :disabled="
                  disabled ||
                  structurePending ||
                  Number(row.key) === rows.length - 1
                "
                @click="moveEntry(row.path, 1)"
              />
            </template>
            <WorkbenchIconButton
              :icon="current?.kind === 'array' ? Trash2 : RotateCcw"
              size="sm"
              variant="secondary"
              :title="
                (current?.kind === 'array' ? '删除 ' : '恢复默认 ') + row.title
              "
              :class="inlineField(row.schema) ? 'order-2' : ''"
              :disabled="disabled"
              @click="
                current?.kind === 'array'
                  ? removeEntry(row.path)
                  : emit('reset', row.path)
              "
            />
            <div
              :class="
                inlineField(row.schema)
                  ? 'order-1 w-56 min-w-[min(100%,8rem)] max-w-full shrink-0'
                  : 'order-3 basis-full min-w-0'
              "
            >
              <SchemaSecretInput
                v-if="row.schema.secret"
                redacted
                :input-id="fieldId(row.path)"
                :is-set="ownProperty(secrets, settingKey(row.path))"
                :draft-value="secretInputs?.[settingKey(row.path)]"
                :disabled="disabled"
                @update:draft-value="
                  (value) => emit('secretInput', row.path, value)
                "
                @commit="(value) => emit('secret', row.path, 'set', value)"
                @clear="emit('secret', row.path, 'clear')"
              />
              <select
                v-else-if="row.schema.reference"
                :id="fieldId(row.path)"
                class="input-base w-full min-w-0 px-2 py-1"
                :value="inputValue(row.path) ?? ''"
                :disabled="disabled"
                @change="
                  editField(
                    row.path,
                    ($event.target as HTMLSelectElement).value,
                  )
                "
              >
                <option value="">
                  {{
                    defaultsAsPlaceholders
                      ? placeholderFor(row.path, row.schema) || "未选择"
                      : "未选择"
                  }}
                </option>
                <template
                  v-for="(option, index) in options(row.schema, row.path)"
                  :key="option.value"
                >
                  <option
                    v-if="
                      option.group &&
                      index > 0 &&
                      option.group !==
                        options(row.schema, row.path)[index - 1]?.group
                    "
                    disabled
                    value="__group_separator__"
                  >
                    ──────── {{ option.group }} ────────
                  </option>
                  <option :value="option.value">
                    {{ option.label ?? option.value }}
                  </option>
                </template>
                <option
                  v-if="
                    inputValue(row.path) &&
                    !options(row.schema, row.path).some(
                      (option) => option.value === String(inputValue(row.path)),
                    )
                  "
                  :value="String(inputValue(row.path))"
                >
                  {{ inputValue(row.path) }}（不存在）
                </option>
              </select>
              <SchemaField
                v-else
                :input-id="fieldId(row.path)"
                :schema="row.schema"
                :default-value="placeholderFor(row.path, row.schema)"
                :default-presentation="
                  defaultsAsPlaceholders ? 'placeholder' : 'value'
                "
                :model-value="inputValue(row.path)"
                :disabled="disabled"
                :single-line="!row.schema.multiline"
                preserve-raw-number
                @update:model-value="editField(row.path, $event)"
              />
            </div>
            <p
              v-if="row.schema.description"
              class="order-4 basis-full text-xs text-text-muted"
            >
              {{ row.schema.description }}
            </p>
            <p
              v-for="issue in issuesFor(row.path)"
              :key="issue.message"
              role="alert"
              class="order-4 basis-full text-xs text-danger"
            >
              {{ issue.message }}
            </p>
          </div>
        </div>
        <div
          v-if="current?.kind === 'array'"
          class="border-b border-border-default p-3"
        >
          <WorkbenchButton
            :icon="Plus"
            label="新增条目"
            size="sm"
            :disabled="disabled || structurePending"
            @click="addArrayItem"
          />
        </div>
        <form
          v-if="current?.kind === 'record'"
          class="flex items-center gap-2 border-b border-border-default p-3"
          @submit.prevent="add"
        >
          <input
            v-model="names[settingKey(path)]"
            aria-label="新条目名称"
            placeholder="新条目名称"
            class="input-base min-w-0 flex-1 px-2 py-1"
            :disabled="disabled"
          />
          <WorkbenchButton
            :icon="Plus"
            title="新增条目"
            size="sm"
            type="submit"
            :disabled="disabled"
          />
        </form>
        <p v-if="error" role="alert" class="p-3 text-sm text-danger">
          {{ error }}
        </p>
        <slot name="after" />
      </template>
    </div>
  </div>
</template>
