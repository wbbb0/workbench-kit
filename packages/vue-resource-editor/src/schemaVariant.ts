import type { UiNode } from "./types.js";

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cloneValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (object(value)) return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, cloneValue(entry)]));
  return value;
}

/** 切换带判别字段的对象分支：保留仍适用的字段，移除不属于新分支的字段。 */
export function projectSchemaVariant(node: UiNode, value: unknown): unknown {
  if (node.schema.kind === "literal") return node.schema.value;
  if (value === undefined) {
    return node.schema.hasDefault ? cloneValue(node.schema.defaultValue) : undefined;
  }
  if (node.kind === "group") {
    const source = object(value) ? value : {};
    return { ...(node.schema.unknownKeys === "passthrough" ? cloneValue(source) as Record<string, unknown> : {}), ...Object.fromEntries(Object.entries(node.children).flatMap(([key, child]) => {
      const next = projectSchemaVariant(child.node, source[key]);
      return next === undefined ? [] : [[key, next]];
    })) };
  }
  if (node.kind === "record" && object(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, projectSchemaVariant(node.value, entry)]));
  }
  if (node.kind === "array" && Array.isArray(value)) {
    return value.map(entry => projectSchemaVariant(node.item, entry));
  }
  if (node.kind === "union") {
    const option = node.options.find(option => matchesSchemaVariant(option, value));
    return option ? projectSchemaVariant(option, value) : undefined;
  }
  if (node.kind === "field" && matchesSchemaVariant(node, value)) return cloneValue(value);
  return node.schema.hasDefault ? cloneValue(node.schema.defaultValue) : undefined;
}

export function matchesSchemaVariant(node: UiNode, value: unknown): boolean {
  if (node.kind === "group") {
    if (!object(value)) return false;
    return Object.entries(node.children).filter(([, child]) => child.node.schema.kind === "literal")
      .every(([key, child]) => matchesSchemaVariant(child.node, value[key]));
  }
  if (node.kind === "record") return object(value);
  if (node.kind === "array") return Array.isArray(value);
  if (node.kind === "union") return node.options.some(option => matchesSchemaVariant(option, value));
  switch (node.schema.kind) {
    case "literal": return value === node.schema.value;
    case "enum": return node.schema.values?.includes(value) ?? false;
    case "string": return typeof value === "string";
    case "number": return typeof value === "number";
    case "boolean": return typeof value === "boolean";
    case "object": return object(value);
    default: return true;
  }
}
