import type { SchemaMeta } from "./types";
export const settingKey = (path: string[]) => JSON.stringify(path);
export function settingValue(root: unknown, path: string[]): unknown {
  for (const key of path) {
    if (!root || typeof root !== "object" || !Object.hasOwn(root, key))
      return undefined;
    root = (root as Record<string, unknown>)[key];
  }
  return root;
}
export function settingBranch(schema: SchemaMeta, value: unknown): SchemaMeta {
  if (schema.kind !== "union") return schema;
  return (
    schema.options?.find((option) =>
      schema.discriminator
        ? option.fields?.[schema.discriminator!]?.schema.value ===
          settingValue(value, [schema.discriminator!])
        : option.kind ===
          (value && typeof value === "object" && !Array.isArray(value)
            ? "object"
            : typeof value),
    ) ??
    schema.options?.[0] ??
    schema
  );
}
export function settingAt(
  root: SchemaMeta,
  values: unknown,
  path: string[],
): SchemaMeta | undefined {
  let schema: SchemaMeta | undefined = root;
  for (let i = 0; i < path.length; i++) {
    schema = settingBranch(schema, settingValue(values, path.slice(0, i)));
    schema =
      schema.kind === "array" && /^(0|[1-9]\d*)$/.test(path[i]!)
        ? schema.item
        : schema.kind === "record"
          ? schema.recordValue
          : schema.fields?.[path[i]!]?.schema;
    if (!schema) return;
  }
  return schema;
}
/** 仅构造新项所需结构；已有默认值继续由宿主解析，秘密通过独立入口写入。 */
export function initialSettingValue(schema: SchemaMeta): unknown {
  if (schema.secret) return undefined;
  if (schema.kind === "union") return initialSettingValue(schema.options![0]!);
  if (schema.kind === "object")
    return Object.fromEntries(
      Object.entries(schema.fields ?? {}).flatMap(([key, field]) => {
        if (
          field.schema.secret ||
          field.schema.optional ||
          (field.schema.hasDefault && field.schema.kind !== "literal")
        )
          return [];
        return [[key, initialSettingValue(field.schema)]];
      }),
    );
  if (schema.kind === "literal") return schema.value;
  if (schema.hasDefault) return JSON.parse(JSON.stringify(schema.defaultValue));
  if (schema.kind === "record") return {};
  if (schema.kind === "array" || schema.kind === "enum-set") return [];
  if (schema.kind === "number") return schema.min ?? 0;
  if (schema.kind === "boolean") return false;
  return "";
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
    const branch = settingBranch(node, settingValue(values, path));
    if (branch.kind === "array")
      for (const key of Object.keys(
        (settingValue(values, path) ?? []) as object,
      ))
        walk(branch.item!, [...path, key]);
    else if (branch.kind === "record")
      for (const key of Object.keys(
        (settingValue(values, path) ?? {}) as object,
      ))
        walk(branch.recordValue!, [...path, key]);
    else
      for (const [key, field] of Object.entries(branch.fields ?? {}))
        walk(field.schema, [...path, key]);
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
/** 将字段目标解析到包含它的页面；record 条目必须实际存在。 */
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
    const field = branch.fields?.[key];
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
          branch.kind === "record" ? key : (field?.title ?? child.title ?? key),
      });
    } else {
      valid = i === target.length - 1;
      if (valid)
        focusPath = node.discriminator === key ? path.slice(0, -1) : path;
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
