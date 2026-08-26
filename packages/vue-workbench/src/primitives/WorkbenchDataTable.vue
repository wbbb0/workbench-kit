<script setup lang="ts" generic="TRow">
import { computed } from "vue";
import WorkbenchEmptyState from "./WorkbenchEmptyState.vue";
import type { WorkbenchDataTableColumn } from "./dataTableTypes";

const props = withDefaults(defineProps<{
  rows: readonly TRow[];
  columns: readonly WorkbenchDataTableColumn<TRow>[];
  getRowKey?: (row: TRow, index: number) => string | number;
  selectedRowKey?: string | number | null;
  stacked?: boolean;
  emptyMessage?: string;
}>(), {
  getRowKey: undefined,
  selectedRowKey: null,
  stacked: false,
  emptyMessage: "暂无数据"
});

const emit = defineEmits<{
  "select-row": [row: TRow];
}>();

const gridStyle = computed(() => ({
  gridTemplateColumns: props.columns.length
    ? `1rem ${props.columns.map((column) => column.width || "minmax(8rem, 1fr)").join(" ")} 1rem`
    : "1rem minmax(7rem, 1fr) 1rem"
}));

const subgridStyle = {
  gridColumn: "1 / -1",
  gridTemplateColumns: "subgrid"
};

function rowKey(row: TRow, index: number): string | number {
  return props.getRowKey?.(row, index) ?? index;
}

function cellClass(row: TRow, column: WorkbenchDataTableColumn<TRow>) {
  const resolved = typeof column.cellClass === "function" ? column.cellClass(row, column) : column.cellClass;
  return [column.class, resolved].filter(Boolean).join(" ");
}

function cellGridStyle(index: number) {
  return { gridColumn: String(index + 2) };
}
</script>

<template>
  <div
    class="scrollbar-thin min-h-0 flex-1 overflow-auto"
    role="table"
    :aria-colcount="columns.length"
    :aria-rowcount="rows.length + (stacked ? 0 : 1)"
  >
    <div
      class="workbench-data-table__grid min-w-full"
      :class="stacked ? 'flex flex-col' : 'grid w-full'"
      :style="stacked ? undefined : gridStyle"
    >
      <div
        v-if="!stacked && columns.length"
        class="workbench-data-table__header grid border-b border-border-default bg-surface-muted font-mono text-small text-text-subtle"
        role="row"
        :style="subgridStyle"
      >
        <div
          v-for="(column, columnIndex) in columns"
          :key="column.key"
          class="workbench-data-table__cell min-w-0 truncate py-2"
          :class="[column.class, column.headerClass]"
          :style="cellGridStyle(columnIndex)"
          role="columnheader"
        >
          {{ column.title || column.key }}
        </div>
      </div>

      <div
        v-for="(row, index) in rows"
        :key="rowKey(row, index)"
        class="workbench-data-table__row min-w-full border-b border-border-subtle text-left text-small hover:bg-surface-hover"
        :class="[
          stacked ? 'flex min-h-16 flex-col gap-1 px-4 py-2' : 'grid min-h-12',
          { 'bg-surface-selected': selectedRowKey !== null && rowKey(row, index) === selectedRowKey }
        ]"
        :style="stacked ? undefined : subgridStyle"
        role="row"
        tabindex="0"
        :aria-selected="selectedRowKey !== null ? rowKey(row, index) === selectedRowKey : undefined"
        @click="emit('select-row', row)"
        @keydown.enter.prevent="emit('select-row', row)"
        @keydown.space.prevent="emit('select-row', row)"
      >
        <div
          v-for="(column, columnIndex) in columns"
          :key="column.key"
          class="workbench-data-table__cell min-w-0 truncate"
          :class="[stacked ? undefined : 'py-2', cellClass(row, column)]"
          :style="stacked ? undefined : cellGridStyle(columnIndex)"
          role="cell"
        >
          <span v-if="stacked" class="mr-1 font-sans text-text-subtle">{{ column.title || column.key }}</span>
          <slot name="cell" :row="row" :column="column">
            {{ row && typeof row === "object" ? String((row as Record<string, unknown>)[column.key] ?? "") : "" }}
          </slot>
        </div>
      </div>

      <WorkbenchEmptyState
        v-if="rows.length === 0"
        class="justify-center px-3 py-6 text-center text-small text-text-subtle"
        :message="emptyMessage"
        :style="stacked ? undefined : { gridColumn: '1 / -1' }"
      />
    </div>
  </div>
</template>
