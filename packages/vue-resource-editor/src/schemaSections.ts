import type { SchemaMeta } from "./types";
import { settingBranch, settingValue } from "./settingsPages";
export type SectionRow = {
  kind: "heading" | "field" | "array" | "variant" | "unsupported" | "invalid";
  path: string[];
  schema: SchemaMeta;
  title: string;
  arrayEntry?: { path: string[]; index: number };
};
/** 只派生展示行，所有值与修改仍归宿主管理；对象层级合并成分区标题。 */
export function schemaSectionRows(
  schema: SchemaMeta,
  values: unknown,
): SectionRow[] {
  const rows: SectionRow[] = [];
  function walk(
    node: SchemaMeta,
    path: string[],
    titles: string[],
    arrayEntry?: SectionRow["arrayEntry"],
  ) {
    const value = settingValue(values, path),
      branch = settingBranch(node, value),
      title = titles.join(" / ");
    if (node.kind === "union")
      rows.push({ kind: "variant", path, schema: node, title });
    if (branch.kind === "object") {
      if (
        value !== undefined &&
        (!value || typeof value !== "object" || Array.isArray(value))
      ) {
        rows.push({ kind: "invalid", path, schema: branch, title, arrayEntry });
        return;
      }
      const fields = Object.entries(branch.fields ?? {}).filter(
        ([key]) => node.discriminator !== key,
      );
      if (
        arrayEntry ||
        (title &&
          fields.some(
            ([, field]) =>
              !["object", "array", "union", "record"].includes(
                field.schema.kind,
              ),
          ))
      )
        rows.push({ kind: "heading", path, schema: branch, title, arrayEntry });
      for (const [key, field] of fields) {
        const child = field.schema;
        if (!["object", "array", "union", "record"].includes(child.kind))
          rows.push({
            kind: child.secret || child.reference ? "unsupported" : "field",
            path: [...path, key],
            schema: child,
            title: field.title ?? child.title ?? key,
          });
      }
      for (const [key, field] of fields)
        if (["object", "array", "union", "record"].includes(field.schema.kind))
          walk(
            field.schema,
            [...path, key],
            [...titles, field.title ?? field.schema.title ?? key],
          );
    } else if (branch.kind === "array") {
      if (value !== undefined && !Array.isArray(value)) {
        rows.push({ kind: "invalid", path, schema: branch, title, arrayEntry });
        return;
      }
      rows.push({ kind: "array", path, schema: branch, title, arrayEntry });
      if (!branch.item) {
        rows.push({ kind: "unsupported", path, schema: branch, title });
        return;
      }
      for (const [index] of ((value ?? []) as unknown[]).entries())
        walk(
          branch.item,
          [...path, String(index)],
          [...titles, `第 ${index + 1} 项`],
          { path, index },
        );
    } else if (branch.kind === "record")
      rows.push({
        kind: "unsupported",
        path,
        schema: branch,
        title,
        arrayEntry,
      });
    else {
      if (arrayEntry)
        rows.push({ kind: "heading", path, schema: branch, title, arrayEntry });
      rows.push({
        kind: branch.secret || branch.reference ? "unsupported" : "field",
        path,
        schema: branch,
        title: branch.title ?? titles.at(-1) ?? "值",
      });
    }
  }
  walk(schema, [], []);
  return rows;
}
