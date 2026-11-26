import { cloneJsonValue, isPlainObject, ownProperty } from "@workbench-kit/schema";
import type { UiNode } from "./types.js";

/** 切换带判别字段的对象分支：保留仍适用的字段，移除不属于新分支的字段。 */
export function projectSchemaVariant(node: UiNode, value: unknown): unknown {
  if (node.schema.kind === "literal") return node.schema.value;
  if (value === undefined) {
    return node.schema.hasDefault ? cloneJsonValue(node.schema.defaultValue) : undefined;
  }
  if (node.kind === "group") {
    const source = isPlainObject(value) ? value : {};
    const variantKey =
      node.schema.variantBy && typeof source[node.schema.variantBy] === "string"
        ? (source[node.schema.variantBy] as string)
        : undefined;
    const variant =
      variantKey !== undefined ? ownProperty(node.variants, variantKey) : undefined;
    const mergedChildren = variant?.children
      ? { ...node.children, ...variant.children }
      : node.children;
    return {
      ...(node.schema.unknownKeys === "passthrough"
        ? (cloneJsonValue(source) as Record<string, unknown>)
        : {}),
      ...Object.fromEntries(
        Object.entries(mergedChildren).flatMap(([key, child]) => {
          const next = projectSchemaVariant(child.node, source[key]);
          return next === undefined ? [] : [[key, next]];
        }),
      ),
    };
  }
  if (node.kind === "record" && isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        projectSchemaVariant(node.value, entry),
      ]),
    );
  }
  if (node.kind === "array" && Array.isArray(value)) {
    return value.map((entry) => projectSchemaVariant(node.item, entry));
  }
  if (node.kind === "union") {
    const option = node.options.find((option) => matchesSchemaVariant(option, value));
    return option ? projectSchemaVariant(option, value) : undefined;
  }
  if (node.kind === "field" && matchesSchemaVariant(node, value)) {
    return cloneJsonValue(value);
  }
  return node.schema.hasDefault ? cloneJsonValue(node.schema.defaultValue) : undefined;
}

export function matchesSchemaVariant(node: UiNode, value: unknown): boolean {
  if (node.kind === "group") {
    if (!isPlainObject(value)) return false;
    return Object.entries(node.children)
      .filter(([, child]) => child.node.schema.kind === "literal")
      .every(([key, child]) => matchesSchemaVariant(child.node, value[key]));
  }
  if (node.kind === "record") return isPlainObject(value);
  if (node.kind === "array") return Array.isArray(value);
  if (node.kind === "union") {
    return node.options.some((option) => matchesSchemaVariant(option, value));
  }
  switch (node.schema.kind) {
    case "literal":
      return value === node.schema.value;
    case "enum":
      return node.schema.values?.includes(value) ?? false;
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number";
    case "boolean":
      return typeof value === "boolean";
    case "object":
      return isPlainObject(value);
    default:
      return true;
  }
}
