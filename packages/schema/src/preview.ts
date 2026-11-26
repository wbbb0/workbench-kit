import { formatDurationValue } from "./duration.js";
import {
  isObjectToggleActive,
  isPlainObject,
  ownProperty,
  resolveObjectVariant,
  resolveSchemaBranch,
  schemaAtPath,
  valueAtPath,
} from "./traversal.js";
import type { SchemaMeta, SchemaPreview } from "./types.js";

const MAX_PREVIEW_DEPTH = 16;

function formatScalar(
  schema: SchemaMeta,
  value: unknown,
  format: "value" | "label" | "count",
  fallback: string,
): string {
  if (schema.secret) return "";
  if (format === "count") {
    if (Array.isArray(value)) return String(value.length);
    if (isPlainObject(value)) return String(Object.keys(value).length);
    return fallback;
  }
  if (value === undefined || value === null || value === "") return fallback;
  if (format === "label") {
    if (Array.isArray(value)) {
      const mapped = value
        .map((item) => ownProperty(schema.valueLabels, String(item)) ?? String(item))
        .filter(Boolean);
      return mapped.length ? mapped.join(", ") : fallback;
    }
    return ownProperty(schema.valueLabels, String(value)) ?? String(value);
  }
  if (typeof value === "number" && schema.format === "duration") {
    return formatDurationValue(value, schema.timescale) || fallback;
  }
  if (typeof value === "boolean") return value ? "开启" : "关闭";
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  return fallback;
}

function evalNode(
  schema: SchemaMeta,
  value: unknown,
  node: SchemaPreview,
  depth: number,
): { text: string; dynamic: boolean; nonEmptyDynamic: boolean } {
  if (typeof node === "string") {
    return { text: node, dynamic: false, nonEmptyDynamic: false };
  }
  if ("ref" in node) {
    const targetSchema = schemaAtPath(schema, value, node.ref);
    if (!targetSchema || targetSchema.secret) {
      return { text: "", dynamic: true, nonEmptyDynamic: false };
    }
    const targetValue = valueAtPath(value, node.ref);
    const fallback = node.fallback ?? "";
    const format = node.format ?? "value";
    if (format === "count") {
      const text = formatScalar(targetSchema, targetValue, "count", fallback);
      return { text, dynamic: true, nonEmptyDynamic: text.length > 0 };
    }
    const branch = resolveSchemaBranch(targetSchema, targetValue);
    if (branch.kind === "object" || branch.kind === "union") {
      const text =
        targetValue === undefined
          ? fallback
          : evaluateSchemaPreview(targetSchema, targetValue, depth + 1) || fallback;
      return { text, dynamic: true, nonEmptyDynamic: text.length > 0 };
    }
    const text = formatScalar(targetSchema, targetValue, format, fallback);
    return { text, dynamic: true, nonEmptyDynamic: text.length > 0 };
  }
  if ("join" in node) {
    const results = node.parts.map((part) => evalNode(schema, value, part, depth));
    const texts = results.map((item) => item.text).filter((text) => text.length > 0);
    const joined = texts.join(node.join);
    const dynamic = results.some((item) => item.dynamic);
    const nonEmptyDynamic = results.some((item) => item.nonEmptyDynamic);
    return { text: joined, dynamic, nonEmptyDynamic };
  }
  const results = node.tpl.map((part) => evalNode(schema, value, part, depth));
  const dynamicItems = results.filter((item) => item.dynamic);
  if (dynamicItems.length > 0) {
    const collapsed = node.all
      ? dynamicItems.some((item) => !item.nonEmptyDynamic)
      : dynamicItems.every((item) => !item.nonEmptyDynamic);
    if (collapsed) {
      return { text: "", dynamic: true, nonEmptyDynamic: false };
    }
  }
  const text = results.map((item) => item.text).join("");
  return {
    text,
    dynamic: dynamicItems.length > 0,
    nonEmptyDynamic: dynamicItems.some((item) => item.nonEmptyDynamic),
  };
}

export function evaluateSchemaPreview(
  schema: SchemaMeta,
  value: unknown,
  depth = 0,
): string {
  if (depth >= MAX_PREVIEW_DEPTH) return "";
  if (schema.secret) return "";
  const branch = resolveSchemaBranch(schema, value);
  if (
    branch.kind === "object" &&
    branch.toggleField &&
    !isObjectToggleActive(branch, value)
  ) {
    return "";
  }
  const variant =
    branch.kind === "object" ? resolveObjectVariant(branch, value) : undefined;
  const preview = variant?.preview ?? branch.preview ?? schema.preview;
  if (!preview) return "";
  return evalNode(branch, value, preview, depth).text;
}
