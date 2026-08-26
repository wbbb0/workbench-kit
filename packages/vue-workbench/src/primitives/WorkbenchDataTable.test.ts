import { h } from "vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import WorkbenchDataTable from "./WorkbenchDataTable.vue";

const columns = [
  { key: "name", title: "Name", width: "minmax(10rem, 1fr)" },
  { key: "status", title: "Status", width: "6rem" },
  { key: "actions", title: "", width: "4rem" }
];

const rows = [
  { id: "short", name: "Short", status: "ready" },
  { id: "long", name: "A very long unbroken value that must not resize one row", status: "ready" }
];

type Row = (typeof rows)[number];

describe("WorkbenchDataTable", () => {
  it("uses one table grid and shares its tracks with every header and data row", () => {
    const wrapper = mount(WorkbenchDataTable, {
      props: {
        rows,
        columns,
        getRowKey: (row: unknown) => (row as Row).id
      }
    });

    const grid = wrapper.get(".workbench-data-table__grid");
    expect(grid.classes()).toContain("grid");
    expect(grid.classes()).not.toContain("w-max");
    expect(grid.attributes("style")).toContain(
      "grid-template-columns: 1rem minmax(10rem, 1fr) 6rem 4rem 1rem"
    );

    const sharedRows = wrapper.findAll("[role='row']");
    expect(sharedRows).toHaveLength(rows.length + 1);
    for (const row of sharedRows) {
      expect(row.attributes("style")).toContain("grid-column: 1 / -1");
      expect(row.attributes("style")).toContain("grid-template-columns: subgrid");
      expect(row.classes()).not.toContain("w-max");
    }

    const firstRowCells = wrapper.findAll(".workbench-data-table__row")[0]!.findAll("[role='cell']");
    expect(firstRowCells.map((cell) => cell.attributes("style"))).toEqual([
      "grid-column: 2;",
      "grid-column: 3;",
      "grid-column: 4;"
    ]);
  });

  it("keeps rows keyboard-selectable without nesting action buttons inside a row button", async () => {
    const wrapper = mount(WorkbenchDataTable, {
      props: {
        rows,
        columns,
        getRowKey: (row: unknown) => (row as Row).id,
        selectedRowKey: "long"
      },
      slots: {
        cell: ({ row, column }: { row: unknown; column: { key: string } }) =>
          column.key === "actions"
            ? h("button", { class: "action-button", onClick: (event: MouseEvent) => event.stopPropagation() }, "Run")
            : String((row as Row)[column.key as "name" | "status"] ?? "")
      }
    });

    const dataRows = wrapper.findAll(".workbench-data-table__row");
    expect(dataRows[0]!.element.tagName).toBe("DIV");
    expect(dataRows[0]!.find("button.action-button").exists()).toBe(true);
    expect(dataRows[1]!.attributes("aria-selected")).toBe("true");

    await dataRows[0]!.trigger("click");
    await dataRows[0]!.trigger("keydown", { key: "Enter" });
    await dataRows[0]!.trigger("keydown", { key: " " });
    expect(wrapper.emitted("select-row")).toEqual([[rows[0]], [rows[0]], [rows[0]]]);
  });

  it("keeps stacked rows out of the shared grid layout", () => {
    const wrapper = mount(WorkbenchDataTable, {
      props: { rows, columns, stacked: true }
    });

    const grid = wrapper.get(".workbench-data-table__grid");
    expect(grid.classes()).toContain("flex");
    expect(grid.classes()).not.toContain("grid");
    expect(grid.attributes("style")).toBeUndefined();
    expect(wrapper.find(".workbench-data-table__header").exists()).toBe(false);

    for (const row of wrapper.findAll(".workbench-data-table__row")) {
      expect(row.classes()).toContain("flex");
      expect(row.attributes("style")).toBeUndefined();
    }
  });
});
