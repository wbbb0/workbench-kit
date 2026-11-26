import {
  evaluateSchemaPreview,
  initialValueForSchema,
  isObjectToggleActive,
  ownProperty,
  resolveObjectFields,
  resolveSchemaBranch,
  schemaAtPath,
  valueAtPath,
} from "@workbench-kit/schema";
import type { SchemaMeta } from "./types.js";

export const settingKey = (path: string[]) => JSON.stringify(path);

export function settingValue(root: unknown, path: string[]): unknown {
  return valueAtPath(root, path);
}

export function settingBranch(schema: SchemaMeta, value: unknown): SchemaMeta {
  if (schema.kind !== "union") return schema;
  const resolved = resolveSchemaBranch(schema, value);
  return resolved === schema ? (schema.options?.[0] ?? schema) : resolved;
}

export function settingAt(
  root: SchemaMeta,
  values: unknown,
  path: string[],
): SchemaMeta | undefined {
  return schemaAtPath(root, values, path);
}

/** 仅构造新项所需结构；已有默认值继续由宿主解析，秘密通过独立入口写入。 */
export function initialSettingValue(schema: SchemaMeta): unknown {
  return initialValueForSchema(schema);
}

export function settingPreview(schema: SchemaMeta, value: unknown): string {
  return evaluateSchemaPreview(schema, value);
}

export function searchSettings(
  schema: SchemaMeta,
  values: unknown,
  query: string,
) {
  const results: { path: string[]; title: string }[] = [];
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return results;
  function walk(node: SchemaMeta, path: string[]) {
    if (
      path.length &&
      `${node.title ?? ""} ${node.description ?? ""} ${path.join(".")}`
        .toLocaleLowerCase()
        .includes(needle)
    )
      results.push({ path, title: node.title ?? path.at(-1)! });
    const value = settingValue(values, path);
    const branch = settingBranch(node, value);
    if (branch.kind === "array") {
      for (const key of Object.keys((value ?? []) as object))
        walk(branch.item!, [...path, key]);
    } else if (branch.kind === "record") {
      for (const key of Object.keys((value ?? {}) as object))
        walk(branch.recordValue!, [...path, key]);
    } else if (branch.kind === "object") {
      for (const [key, field] of Object.entries(
        resolveObjectFields(branch, value),
      )) {
        walk(field.schema, [...path, key]);
      }
    } else {
      for (const [key, field] of Object.entries(branch.fields ?? {}))
        walk(field.schema, [...path, key]);
    }
  }
  walk(schema, []);
  return results;
}

export const isSettingPage = (schema: SchemaMeta) =>
  ["object", "record", "union", "array"].includes(schema.kind);

export interface SettingsPageLocation {
  path: string[];
  title: string;
}

/** 将字段目标解析到包含它的页面；record 条目必须实际存在，关闭的 toggleField 对象停在该对象页并聚焦开关。 */
export function resolveSettingsPage(
  schema: SchemaMeta,
  values: unknown,
  target: string[],
) {
  const pages: SettingsPageLocation[] = [
    { path: [], title: schema.title ?? "设置" },
  ];
  let node = schema;
  let value = values;
  let focusPath: string[] | undefined;
  let valid = true;
  for (let i = 0; i < target.length; i++) {
    const key = target[i]!;
    const branch = settingBranch(node, value);
    if (
      branch.kind === "object" &&
      branch.toggleField &&
      !isObjectToggleActive(branch, value) &&
      key !== branch.toggleField
    ) {
      focusPath = [...target.slice(0, i), branch.toggleField];
      break;
    }
    const fields =
      branch.kind === "object"
        ? resolveObjectFields(branch, value)
        : branch.fields;
    const field = ownProperty(fields, key);
    const child =
      branch.kind === "array" && /^(0|[1-9]\d*)$/.test(key)
        ? branch.item
        : branch.kind === "record"
          ? branch.recordValue
          : field?.schema;
    if (
      !child ||
      (["record", "array"].includes(branch.kind) &&
        (!value || typeof value !== "object" || !Object.hasOwn(value, key)))
    ) {
      valid = false;
      break;
    }
    const path = target.slice(0, i + 1);
    if (isSettingPage(child)) {
      pages.push({
        path,
        title:
          branch.kind === "record"
            ? key
            : (field?.title ?? child.title ?? key),
      });
    } else {
      valid = i === target.length - 1;
      if (valid)
        focusPath =
          node.discriminator === key || branch.variantBy === key
            ? path.slice(0, -1)
            : path;
      break;
    }
    node = child;
    value = settingValue(value, [key]);
  }
  return { pages, path: pages.at(-1)!.path, focusPath, valid };
}

export type SettingsStructureEdit =
  | { type: "array"; path: string[]; operation: "append"; value: unknown }
  | { type: "array"; path: string[]; operation: "remove"; index: number }
  | { type: "array"; path: string[]; operation: "move"; from: number; to: number }
  | { type: "reset"; path: string[] }
  | { type: "set"; path: string[]; value: unknown };
