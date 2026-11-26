import {
  evaluateSchemaPreview,
  isObjectToggleActive,
  ownProperty,
  resolveObjectFields,
  resolveObjectVariantMeta,
} from "@workbench-kit/schema";
import type { SchemaMeta } from "./types.js";
import { settingBranch, settingValue } from "./settingsPages.js";

export type SectionRow = {
  kind: "heading" | "field" | "array" | "variant" | "unsupported" | "invalid";
  path: string[];
  schema: SchemaMeta;
  title: string;
  preview?: string;
  toggle?: {
    path: string[];
    schema: SchemaMeta;
    title: string;
    active: boolean;
  };
  variant?: {
    key: string;
    label: string;
    optional: boolean;
    current?: string;
    options: { value: string; label: string; disabled?: boolean }[];
  };
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
    entryPreview?: string,
  ) {
    const value = settingValue(values, path);
    const branch = settingBranch(node, value);
    const title = titles.join(" / ");
    if (node.kind === "union") {
      rows.push({ kind: "variant", path, schema: node, title });
    }
    if (branch.kind === "object") {
      if (
        value !== undefined &&
        (!value || typeof value !== "object" || Array.isArray(value))
      ) {
        rows.push({ kind: "invalid", path, schema: branch, title, arrayEntry });
        return;
      }
      const toggleFieldKey = branch.toggleField;
      const toggleFieldMeta = toggleFieldKey
        ? ownProperty(branch.fields, toggleFieldKey)
        : undefined;
      const toggleActive = toggleFieldKey
        ? isObjectToggleActive(branch, value)
        : true;
      const toggle =
        toggleFieldKey && toggleFieldMeta
          ? {
              path: [...path, toggleFieldKey],
              schema: toggleFieldMeta.schema,
              title:
                toggleFieldMeta.title ??
                toggleFieldMeta.schema.title ??
                toggleFieldKey,
              active: toggleActive,
            }
          : undefined;
      const preview =
        entryPreview || evaluateSchemaPreview(branch, value) || undefined;

      const resolvedFields = resolveObjectFields(branch, value);
      const fields = Object.entries(resolvedFields).filter(
        ([key]) =>
          node.discriminator !== key &&
          toggleFieldKey !== key &&
          branch.variantBy !== key,
      );
      if (
        toggle ||
        arrayEntry ||
        (title &&
          (fields.some(
            ([, field]) =>
              !["object", "array", "union", "record"].includes(
                field.schema.kind,
              ),
          ) ||
            Boolean(branch.variantBy && branch.variants)))
      ) {
        rows.push({
          kind: "heading",
          path,
          schema: branch,
          title: title || branch.title || "设置",
          ...(preview ? { preview } : {}),
          ...(toggle ? { toggle } : {}),
          ...(arrayEntry ? { arrayEntry } : {}),
        });
      }
      if (toggle && !toggle.active) return;

      const variantMeta = resolveObjectVariantMeta(branch, value, title || "类型");
      if (variantMeta) {
        rows.push({
          kind: "variant",
          path,
          schema: branch,
          title,
          variant: {
            key: variantMeta.key,
            label: variantMeta.label,
            optional: variantMeta.optional,
            ...(variantMeta.currentKey !== undefined
              ? { current: variantMeta.currentKey }
              : {}),
            options: variantMeta.options.map((option) => ({
              value: option.value,
              label: option.label,
              ...(option.disabled ? { disabled: true } : {}),
            })),
          },
        });
        if (branch.optional && value === undefined) return;
      }

      for (const [key, field] of fields) {
        const child = field.schema;
        if (!["object", "array", "union", "record"].includes(child.kind)) {
          rows.push({
            kind: "field",
            path: [...path, key],
            schema: child,
            title: field.title ?? child.title ?? key,
          });
        }
      }
      for (const [key, field] of fields) {
        if (["object", "array", "union", "record"].includes(field.schema.kind)) {
          walk(
            field.schema,
            [...path, key],
            [...titles, field.title ?? field.schema.title ?? key],
          );
        }
      }
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
      for (const [index, entryValue] of ((value ?? []) as unknown[]).entries()) {
        const preview = evaluateSchemaPreview(branch.item, entryValue);
        walk(
          branch.item,
          [...path, String(index)],
          [...titles, `第 ${index + 1} 项`],
          { path, index },
          preview || undefined,
        );
      }
    } else if (branch.kind === "record") {
      rows.push({
        kind: "unsupported",
        path,
        schema: branch,
        title,
        arrayEntry,
      });
    } else {
      if (arrayEntry) {
        rows.push({
          kind: "heading",
          path,
          schema: branch,
          title,
          ...(entryPreview ? { preview: entryPreview } : {}),
          arrayEntry,
        });
      }
      rows.push({
        kind: "field",
        path,
        schema: branch,
        title: branch.title ?? titles.at(-1) ?? "值",
      });
    }
  }
  walk(schema, [], []);
  return rows;
}
