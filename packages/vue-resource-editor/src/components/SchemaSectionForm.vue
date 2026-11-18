<script setup lang="ts">
import { computed } from "vue";
import { WorkbenchButton } from "@workbench-kit/vue-workbench";
import SchemaField from "./SchemaField.vue";
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
    disabled?: boolean;
    issues?: { path: string[]; message: string }[];
    defaultsAsPlaceholders?: boolean;
  }>(),
  { defaultsAsPlaceholders: true },
);
const emit = defineEmits<{
  edit: [path: string[], value: unknown];
  reset: [path: string[]];
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
  emit(
    "edit",
    row.path,
    initialSettingValue(
      row.schema.options![Number((event.target as HTMLSelectElement).value)]!,
    ),
  );
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
        <h3 class="min-w-0 flex-1 text-sm font-medium">{{ row.title }}</h3>
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
          <SchemaField
            :schema="row.schema"
            :single-line="!row.schema.multiline"
            :input-id="'section-' + settingKey(row.path)"
            :model-value="settingValue(overrides ?? values, row.path)"
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
            @update:model-value="(value) => emit('edit', row.path, value)"
          />
        </div>
        <WorkbenchButton
          label="恢复默认"
          size="sm"
          variant="secondary"
          :disabled="disabled"
          @click="emit('reset', row.path)"
        />
      </div>
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
