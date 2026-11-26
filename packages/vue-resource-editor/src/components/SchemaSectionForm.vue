<script setup lang="ts">
import { computed } from "vue";
import { applyVariantChange, ownProperty } from "@workbench-kit/schema";
import { WorkbenchButton } from "@workbench-kit/vue-workbench";
import SchemaField from "./SchemaField.vue";
import SchemaSecretInput from "./SchemaSecretInput.vue";
import type { SchemaMeta } from "../types";
import {
  initialSettingValue,
  settingKey,
  settingValue,
  settingBranch,
} from "../settingsPages";
import { schemaSectionRows, type SectionRow } from "../schemaSections";

const props = withDefaults(
  defineProps<{
    schema: SchemaMeta;
    values: Record<string, unknown>;
    overrides?: Record<string, unknown>;
    secrets?: Record<string, boolean>;
    secretInputs?: Record<string, string>;
    referenceOptions?: Record<
      string,
      { value: string; label?: string; group?: string }[]
    >;
    disabled?: boolean;
    issues?: { path: string[]; message: string }[];
    defaultsAsPlaceholders?: boolean;
  }>(),
  { defaultsAsPlaceholders: true },
);

const emit = defineEmits<{
  edit: [path: string[], value: unknown];
  reset: [path: string[]];
  secretInput: [path: string[], value: string];
  secret: [path: string[], action: "set" | "clear", value?: string];
}>();

const rows = computed(() => schemaSectionRows(props.schema, props.values));

function arrayItems(path: string[]) {
  const value = settingValue(props.values, path);
  return Array.isArray(value) ? [...value] : [];
}
function add(row: SectionRow) {
  const items = arrayItems(row.path);
  items.push(initialSettingValue(row.schema.item!));
  emit("edit", row.path, items);
}
function remove(row: SectionRow) {
  if (!row.arrayEntry) return;
  const items = arrayItems(row.arrayEntry.path);
  items.splice(row.arrayEntry.index, 1);
  emit("edit", row.arrayEntry.path, items);
}
function move(row: SectionRow, offset: number) {
  if (!row.arrayEntry) return;
  const { path, index } = row.arrayEntry,
    items = arrayItems(path),
    next = index + offset;
  if (next < 0 || next >= items.length) return;
  [items[index], items[next]] = [items[next], items[index]];
  emit("edit", path, items);
}
function variant(row: SectionRow, event: Event) {
  if (row.variant) {
    const next = (event.target as HTMLSelectElement).value;
    if (!next) {
      emit("reset", row.path);
      return;
    }
    emit(
      "edit",
      row.path,
      applyVariantChange(row.schema, settingValue(props.values, row.path), next),
    );
    return;
  }
  emit(
    "edit",
    row.path,
    initialSettingValue(
      row.schema.options![Number((event.target as HTMLSelectElement).value)]!,
    ),
  );
}
function referenceList(schema: SchemaMeta, path: string[]) {
  return (
    props.referenceOptions?.[settingKey(path)] ??
    props.referenceOptions?.[settingKey([...path.slice(0, -1), "*"])] ??
    Object.keys(
      (settingValue(props.values, schema.reference?.path ?? []) ?? {}) as object,
    ).map((value) => ({
      value,
      label: value,
      group: undefined as string | undefined,
    }))
  );
}
function toggleChecked(toggle: NonNullable<SectionRow["toggle"]>): boolean {
  const raw = settingValue(props.overrides ?? props.values, toggle.path);
  if (raw !== undefined) return raw === true;
  if (props.defaultsAsPlaceholders) return false;
  return toggle.active;
}
function toggleIndeterminate(toggle: NonNullable<SectionRow["toggle"]>): boolean {
  return (
    props.defaultsAsPlaceholders &&
    settingValue(props.overrides ?? props.values, toggle.path) === undefined
  );
}
function fieldValue(path: string[]) {
  return settingValue(props.overrides ?? props.values, path);
}
function editField(path: string[], value: unknown) {
  if (props.defaultsAsPlaceholders && (value === "" || value === undefined)) {
    emit("reset", path);
  } else {
    emit("edit", path, value);
  }
}
const issuesFor = (path: string[]) =>
  props.issues?.filter(
    (issue) => settingKey(issue.path) === settingKey(path),
  ) ?? [];
</script>
<template>
  <div
    class="scrollbar-thin min-h-0 flex-1 overflow-y-auto"
    aria-label="分区配置表单"
  >
    <div
      v-for="row in rows"
      :key="row.kind + settingKey(row.path)"
      :data-setting-path="settingKey(row.path)"
      class="border-b border-border-default px-3 py-2"
    >
      <div
        v-if="row.kind === 'heading' || row.kind === 'array'"
        class="flex flex-wrap items-center gap-2"
      >
        <input
          v-if="row.toggle"
          :id="'section-' + settingKey(row.toggle.path)"
          type="checkbox"
          class="cursor-pointer accent-accent"
          :aria-label="row.title + ' 开关'"
          :checked="toggleChecked(row.toggle)"
          :indeterminate="toggleIndeterminate(row.toggle)"
          :title="row.toggle.title"
          :disabled="disabled"
          @change="
            emit(
              'edit',
              row.toggle.path,
              ($event.target as HTMLInputElement).checked,
            )
          "
        />
        <div class="min-w-0 flex-1">
          <h3 class="truncate text-sm font-medium">{{ row.title }}</h3>
          <p v-if="row.preview" class="truncate text-xs text-text-muted">
            {{ row.preview }}
          </p>
        </div>
        <WorkbenchButton
          v-if="row.toggle"
          label="恢复默认"
          size="sm"
          variant="secondary"
          :disabled="disabled"
          @click="emit('reset', row.toggle.path)"
        />
        <template v-if="row.arrayEntry"
          ><WorkbenchButton
            label="上移"
            size="sm"
            :disabled="disabled || row.arrayEntry.index === 0"
            @click="move(row, -1)" /><WorkbenchButton
            label="下移"
            size="sm"
            :disabled="
              disabled ||
              row.arrayEntry.index >= arrayItems(row.arrayEntry.path).length - 1
            "
            @click="move(row, 1)" /><WorkbenchButton
            label="删除此项"
            size="sm"
            variant="danger"
            :disabled="disabled"
            @click="remove(row)"
        /></template>
        <WorkbenchButton
          v-if="row.kind === 'array' && row.schema.item"
          label="新增条目"
          size="sm"
          :disabled="disabled"
          @click="add(row)"
        />
      </div>
      <div
        v-else-if="row.kind === 'field'"
        class="flex flex-wrap items-start gap-x-4 gap-y-2"
      >
        <label
          :for="'section-' + settingKey(row.path)"
          :title="row.schema.description"
          class="min-w-[min(100%,10rem)] flex-1 text-sm"
          >{{ row.title }}</label
        >
        <div class="min-w-[min(100%,12rem)] flex-1">
          <SchemaSecretInput
            v-if="row.schema.secret && secrets !== undefined"
            redacted
            :input-id="'section-' + settingKey(row.path)"
            :is-set="ownProperty(secrets, settingKey(row.path))"
            :draft-value="secretInputs?.[settingKey(row.path)]"
            :disabled="disabled"
            @update:draft-value="(value) => emit('secretInput', row.path, value)"
            @commit="(value) => emit('secret', row.path, 'set', value)"
            @clear="emit('secret', row.path, 'clear')"
          />
          <SchemaSecretInput
            v-else-if="row.schema.secret"
            :input-id="'section-' + settingKey(row.path)"
            :model-value="fieldValue(row.path)"
            :disabled="disabled"
            @update:model-value="(value) => editField(row.path, value)"
          />
          <select
            v-else-if="row.schema.reference"
            :id="'section-' + settingKey(row.path)"
            class="input-base w-full min-w-0 px-2 py-1"
            :value="fieldValue(row.path) ?? ''"
            :disabled="disabled"
            @change="
              editField(row.path, ($event.target as HTMLSelectElement).value)
            "
          >
            <option value="">未选择</option>
            <template
              v-for="(option, index) in referenceList(row.schema, row.path)"
              :key="option.value"
            >
              <option
                v-if="
                  option.group &&
                  index > 0 &&
                  option.group !==
                    referenceList(row.schema, row.path)[index - 1]?.group
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
          </select>
          <SchemaField
            v-else
            :schema="row.schema"
            :single-line="!row.schema.multiline"
            :input-id="'section-' + settingKey(row.path)"
            :model-value="fieldValue(row.path)"
            :inherited="
              defaultsAsPlaceholders
                ? undefined
                : settingValue(values, row.path)
            "
            :default-value="row.schema.defaultValue"
            :disabled="disabled"
            preserve-raw-number
            :default-presentation="
              defaultsAsPlaceholders ? 'placeholder' : 'value'
            "
            @update:model-value="(value) => editField(row.path, value)"
          />
        </div>
        <WorkbenchButton
          v-if="!row.schema.secret"
          label="恢复默认"
          size="sm"
          variant="secondary"
          :disabled="disabled"
          @click="emit('reset', row.path)"
        />
      </div>
      <label
        v-else-if="row.kind === 'variant' && row.variant"
        class="flex items-center gap-3 text-sm"
        >{{ row.variant.label
        }}<select
          class="input-base min-w-0 flex-1 px-2 py-1"
          :disabled="disabled"
          :value="row.variant.current ?? ''"
          @change="variant(row, $event)"
        >
          <option v-if="row.variant.optional" value="">未设置</option>
          <option
            v-for="option in row.variant.options"
            :key="option.value"
            :value="option.value"
            :disabled="option.disabled && row.variant.current !== option.value"
          >
            {{ option.label }}
          </option>
        </select></label
      >
      <label
        v-else-if="row.kind === 'variant'"
        class="flex items-center gap-3 text-sm"
        >{{ row.title
        }}<select
          :disabled="disabled"
          :value="
            row.schema.options?.indexOf(
              settingBranch(row.schema, settingValue(values, row.path)),
            )
          "
          @change="variant(row, $event)"
        >
          <option
            v-for="(option, index) in row.schema.options"
            :key="index"
            :value="index"
            :disabled="option.disabled"
          >
            {{ option.title ?? option.kind }}
          </option>
        </select></label
      >
      <div
        v-else-if="row.kind === 'invalid'"
        role="alert"
        class="flex items-center gap-2 text-sm text-danger"
      >
        <span
          >{{ row.title }}：值应为{{
            row.schema.kind === "array" ? "数组" : "对象"
          }}，当前输入已保留。</span
        ><WorkbenchButton
          label="恢复默认"
          size="sm"
          :disabled="disabled"
          @click="emit('reset', row.path)"
        />
      </div>
      <p v-else role="alert" class="text-sm text-text-muted">
        {{ row.title }}：分区表单暂不支持
        {{
          row.schema.secret
            ? "秘密字段"
            : row.schema.reference
              ? "引用字段"
              : row.schema.kind
        }}，请使用页面式编辑器。
      </p>
      <template v-if="row.toggle">
        <p
          v-for="issue in issuesFor(row.toggle.path)"
          :key="issue.message"
          role="alert"
          class="mt-1 text-xs text-danger"
        >
          {{ issue.message }}
        </p>
      </template>
      <p
        v-for="issue in issuesFor(row.path)"
        :key="issue.message"
        role="alert"
        class="mt-1 text-xs text-danger"
      >
        {{ issue.message }}
      </p>
    </div>
  </div>
</template>
