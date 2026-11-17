<script setup lang="ts">
import {
  computed,
  ref,
  nextTick,
  watch,
  onActivated,
  onDeactivated,
  onMounted,
  onBeforeUnmount,
} from "vue";
import {
  ChevronRight,
  ArrowLeft,
  Plus,
  Trash2,
  RotateCcw,
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
} from "../settingsPages";
const props = withDefaults(
  defineProps<{
    schema: SchemaMeta;
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
  if (!props.focusPath || !content.value) return;
  const target = Array.from(
    content.value.querySelectorAll<HTMLElement>("[data-setting-path]"),
  ).find(
    (element) => element.dataset.settingPath === settingKey(props.focusPath!),
  );
  target?.scrollIntoView?.({ block: "nearest" });
  target?.focus({ preventScroll: true });
}
onMounted(restorePosition);
onBeforeUnmount(savePosition);
watch(
  () => props.focusPath,
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
onDeactivated(savePosition);
onActivated(restorePosition);
const names = ui.names;
const error = ref("");
const original = computed(() =>
  settingAt(props.schema, props.values, props.path),
);
const current = computed(() =>
  original.value
    ? settingBranch(original.value, settingValue(props.values, props.path))
    : undefined,
);
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
const rows = computed(() => {
  const node = current.value;
  if (!node) return [];
  if (node.kind === "record")
    return Object.keys(
      (settingValue(props.values, props.path) ?? {}) as object,
    ).map((key) => ({
      key,
      schema: node.recordValue!,
      path: [...props.path, key],
      title: key,
      entry: true,
    }));
  if (node.kind === "object")
    return Object.entries(node.fields ?? {})
      .filter(([key]) => key !== original.value?.discriminator)
      .map(([key, field]) => ({
        key,
        schema: field.schema,
        path: [...props.path, key],
        title: field.title ?? field.schema.title ?? key,
        entry: false,
      }));
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
const options = (schema: SchemaMeta) =>
  Object.keys(
    (settingValue(props.values, schema.reference?.path ?? []) ?? {}) as object,
  );
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
function changeVariant(event: Event) {
  const option =
    original.value!.options![
      Number((event.target as HTMLSelectElement).value)
    ]!;
  emit("edit", props.path, initialSettingValue(option));
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
    <div ref="content" class="min-h-0 flex-1 overflow-auto">
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
            :disabled="disabled"
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
          v-if="original?.kind === 'union'"
          class="flex items-center gap-3 border-b border-border-default p-3"
        >
          <label class="text-sm">类型</label>
          <select
            aria-label="类型"
            :data-setting-path="settingKey(path)"
            class="input-base min-w-0 flex-1 px-2 py-1"
            :value="original.options?.indexOf(current!)"
            :disabled="disabled"
            @change="changeVariant"
          >
            <option v-for="(option, i) in original.options" :key="i" :value="i">
              {{ option.title ?? option.kind }}
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
            <button
              class="flex min-w-0 flex-1 items-center justify-between gap-2 px-4 py-3 text-left text-sm hover:bg-surface-hover"
              @click="go(row.path)"
            >
              <span class="truncate">{{ row.title }}</span
              ><ChevronRight :size="16" />
            </button>
            <WorkbenchIconButton
              v-if="row.entry"
              :icon="Trash2"
              :title="'删除 ' + row.title"
              size="sm"
              variant="secondary"
              class="mr-3"
              :disabled="disabled"
              @click="emit('reset', row.path)"
            />
          </div>
          <div
            v-else
            class="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2"
          >
            <label
              class="min-w-0 flex-1 text-sm"
              :class="inlineField(row.schema) ? 'min-w-[min(100%,8rem)]' : ''"
              :for="'setting-' + settingKey(row.path)"
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
            <WorkbenchIconButton
              :icon="RotateCcw"
              size="sm"
              variant="secondary"
              :title="'恢复默认 ' + row.title"
              :class="inlineField(row.schema) ? 'order-2' : ''"
              :disabled="disabled"
              @click="emit('reset', row.path)"
            />
            <div
              :class="
                inlineField(row.schema)
                  ? 'order-1 w-56 min-w-[min(100%,8rem)] max-w-full shrink-0'
                  : 'order-3 basis-full min-w-0'
              "
            >
              <div
                v-if="row.schema.secret"
                class="flex flex-wrap items-center gap-2"
              >
                <input
                  :id="'setting-' + settingKey(row.path)"
                  type="password"
                  autocomplete="new-password"
                  :placeholder="
                    secrets?.[settingKey(row.path)]
                      ? '已设置，输入以替换'
                      : '未设置'
                  "
                  class="input-base min-w-0 flex-1 px-2 py-1"
                  :value="secretInputs?.[settingKey(row.path)] ?? ''"
                  :disabled="disabled"
                  @input="
                    emit(
                      'secretInput',
                      row.path,
                      ($event.target as HTMLInputElement).value,
                    )
                  "
                />
                <WorkbenchButton
                  label="替换"
                  size="sm"
                  :disabled="
                    disabled ||
                    secretInputs?.[settingKey(row.path)] === undefined
                  "
                  @click="
                    emit(
                      'secret',
                      row.path,
                      'set',
                      secretInputs?.[settingKey(row.path)],
                    )
                  "
                />
                <WorkbenchButton
                  label="清除"
                  size="sm"
                  variant="danger"
                  :disabled="disabled"
                  @click="emit('secret', row.path, 'clear')"
                />
              </div>
              <select
                v-else-if="row.schema.reference"
                :id="'setting-' + settingKey(row.path)"
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
                <option
                  v-for="option in options(row.schema)"
                  :key="option"
                  :value="option"
                >
                  {{ option }}
                </option>
                <option
                  v-if="
                    inputValue(row.path) &&
                    !options(row.schema).includes(String(inputValue(row.path)))
                  "
                  :value="String(inputValue(row.path))"
                >
                  {{ inputValue(row.path) }}（不存在）
                </option>
              </select>
              <SchemaField
                v-else
                :input-id="'setting-' + settingKey(row.path)"
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
