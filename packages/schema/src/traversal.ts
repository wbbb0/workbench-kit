import type { ObjectFieldMeta, ObjectVariantMeta, SchemaMeta } from "./types.js";

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function cloneJsonValue<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}

export function ownProperty<T>(
  record: Readonly<Record<string, T>> | undefined,
  key: string,
): T | undefined {
  return record && Object.hasOwn(record, key) ? record[key] : undefined;
}

export function valueAtPath(root: unknown, path: readonly string[]): unknown {
  let current = root;
  for (const key of path) {
    if (
      (!isPlainObject(current) && !Array.isArray(current)) ||
      !Object.hasOwn(current, key)
    ) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

export interface ResolvedVariantMeta {
  key: string;
  label: string;
  optional: boolean;
  currentKey?: string;
  options: { value: string; label: string; disabled: boolean }[];
}

export function resolveSchemaBranch(
  schema: SchemaMeta,
  value: unknown,
): SchemaMeta {
  if (schema.kind !== "union") return schema;
  if (schema.discriminator) {
    if (!isPlainObject(value) || !Object.hasOwn(value, schema.discriminator)) {
      return schema;
    }
    return (
      schema.options?.find((option) => {
        const field = ownProperty(option.fields, schema.discriminator!)?.schema;
        return field?.kind === "literal" && field.value === value[schema.discriminator!];
      }) ?? schema
    );
  }
  return (
    schema.options?.find(
      (option) => option.kind === (isPlainObject(value) ? "object" : typeof value),
    ) ?? schema
  );
}

export function resolveObjectVariantKey(
  schema: Pick<SchemaMeta, "variantBy" | "variants" | "fields" | "optional">,
  value: unknown,
): string | undefined {
  if (!schema.variantBy || !schema.variants) return undefined;
  const raw = isPlainObject(value) ? value[schema.variantBy] : undefined;
  if (typeof raw === "string") return raw;
  if (value === undefined && schema.optional) return undefined;
  const variantField = ownProperty(schema.fields, schema.variantBy)?.schema;
  if (variantField?.hasDefault && typeof variantField.defaultValue === "string") {
    return variantField.defaultValue;
  }
  return undefined;
}

export function resolveObjectVariant(
  schema: Pick<SchemaMeta, "variantBy" | "variants" | "fields" | "optional">,
  value: unknown,
): ObjectVariantMeta | undefined {
  const key = resolveObjectVariantKey(schema, value);
  return key !== undefined ? ownProperty(schema.variants, key) : undefined;
}

export function resolveObjectVariantMeta(
  schema: Pick<SchemaMeta, "kind" | "variantBy" | "variants" | "fields" | "optional" | "title">,
  value: unknown,
  fallbackLabel = "类型",
): ResolvedVariantMeta | undefined {
  if (schema.kind !== "object" || !schema.variantBy || !schema.variants) {
    return undefined;
  }
  const variantField = ownProperty(schema.fields, schema.variantBy);
  const currentKey = resolveObjectVariantKey(schema, value);
  const enumValues = Array.isArray(variantField?.schema.values)
    ? variantField!.schema.values.map(String)
    : Object.keys(schema.variants);
  const optionKeys = [...new Set([...enumValues, ...Object.keys(schema.variants)])];
  return {
    key: schema.variantBy,
    label: variantField?.title ?? variantField?.schema.title ?? fallbackLabel,
    optional: schema.optional,
    ...(currentKey !== undefined ? { currentKey } : {}),
    options: optionKeys.map((key) => {
      const meta = ownProperty(schema.variants, key);
      const label =
        meta?.title ?? ownProperty(variantField?.schema.valueLabels, key) ?? key;
      return {
        value: key,
        label,
        disabled: !!meta?.disabled && currentKey !== key,
      };
    }),
  };
}

export function resolveObjectFields(
  schema: Pick<SchemaMeta, "fields" | "variantBy" | "variants" | "optional">,
  value: unknown,
  options?: { allVariants?: boolean },
): Record<string, ObjectFieldMeta> {
  const base = schema.fields ?? {};
  if (!schema.variantBy || !schema.variants) return base;
  if (options?.allVariants) {
    const merged: Record<string, ObjectFieldMeta> = { ...base };
    for (const variant of Object.values(schema.variants)) {
      if (variant.fields) Object.assign(merged, variant.fields);
    }
    return merged;
  }
  const variant = resolveObjectVariant(schema, value);
  if (!variant?.fields) return base;
  return { ...base, ...variant.fields };
}

export function isObjectToggleActive(
  schema: Pick<SchemaMeta, "toggleField" | "fields">,
  value: unknown,
  override?: unknown,
): boolean {
  if (!schema.toggleField) return true;
  if (isPlainObject(override) && Object.hasOwn(override, schema.toggleField)) {
    return override[schema.toggleField] === true;
  }
  if (isPlainObject(value) && Object.hasOwn(value, schema.toggleField)) {
    return value[schema.toggleField] === true;
  }
  const toggleSchema = ownProperty(schema.fields, schema.toggleField)?.schema;
  return toggleSchema?.hasDefault ? toggleSchema.defaultValue === true : false;
}

export function schemaAtPath(
  root: SchemaMeta,
  values: unknown,
  path: readonly string[],
): SchemaMeta | undefined {
  let schema: SchemaMeta | undefined = root;
  let current = values;
  for (const key of path) {
    schema = resolveSchemaBranch(schema, current);
    if (schema.kind === "array" && /^(0|[1-9][0-9]*)$/.test(key)) {
      schema = schema.item;
    } else if (schema.kind === "record") {
      schema = schema.recordValue;
    } else if (schema.kind === "object") {
      schema = ownProperty(resolveObjectFields(schema, current), key)?.schema;
    } else {
      schema = ownProperty(schema.fields, key)?.schema;
    }
    if (!schema) return undefined;
    current =
      (isPlainObject(current) || Array.isArray(current)) &&
      Object.hasOwn(current, key)
        ? (current as Record<string, unknown>)[key]
        : undefined;
  }
  return schema;
}

function pruneValueToSchema(schema: SchemaMeta, value: unknown): unknown {
  if (value === undefined) return undefined;
  const branch = resolveSchemaBranch(schema, value);
  if (branch !== schema) return pruneValueToSchema(branch, value);
  if (schema.kind === "array" && Array.isArray(value) && schema.item) {
    return value.map((item) => pruneValueToSchema(schema.item!, item));
  }
  if (schema.kind === "record" && isPlainObject(value) && schema.recordValue) {
    return Object.fromEntries(
      Object.entries(value).flatMap(([key, entry]) => {
        const next = pruneValueToSchema(schema.recordValue!, entry);
        return next === undefined ? [] : [[key, next]];
      }),
    );
  }
  if (schema.kind === "object" && isPlainObject(value)) {
    const fields = resolveObjectFields(schema, value);
    return Object.fromEntries(
      Object.entries(value).flatMap(([key, entry]) => {
        const field = ownProperty(fields, key)?.schema;
        if (!field) return [];
        const next = pruneValueToSchema(field, entry);
        return next === undefined ? [] : [[key, next]];
      }),
    );
  }
  return cloneJsonValue(value);
}

/** 切换 object 的 variantBy 选项：保留公共字段（及可选的同类型同名非机密字段）并裁剪不再适用的嵌套键，彻底清除旧分支专属字段。 */
export function applyVariantChange(
  schema: SchemaMeta,
  current: unknown,
  nextVariant: string | undefined,
): Record<string, unknown> | undefined {
  if (!schema.variantBy) {
    return isPlainObject(current) ? cloneJsonValue(current) : undefined;
  }
  if (nextVariant === undefined) return undefined;
  const source = isPlainObject(current) ? current : {};
  const commonFields = schema.fields ?? {};
  const nextRoot: Record<string, unknown> = {
    [schema.variantBy]: nextVariant,
  };
  const nextFields = resolveObjectFields(schema, {
    [schema.variantBy]: nextVariant,
  });
  for (const [key, field] of Object.entries(commonFields)) {
    if (key === schema.variantBy) continue;
    if (!Object.hasOwn(source, key)) continue;
    const targetSchema = ownProperty(nextFields, key)?.schema ?? field.schema;
    const pruned = pruneValueToSchema(targetSchema, source[key]);
    if (pruned !== undefined) nextRoot[key] = pruned;
  }
  if (schema.variantPreserve === "matching") {
    const oldFields = resolveObjectFields(schema, source);
    for (const [key, field] of Object.entries(nextFields)) {
      if (key === schema.variantBy) continue;
      if (ownProperty(commonFields, key)) continue;
      if (!Object.hasOwn(source, key)) continue;
      const oldField = ownProperty(oldFields, key);
      if (
        !oldField ||
        oldField.schema.secret ||
        field.schema.secret ||
        oldField.schema.kind !== field.schema.kind
      ) {
        continue;
      }
      const pruned = pruneValueToSchema(field.schema, source[key]);
      if (pruned !== undefined) nextRoot[key] = pruned;
    }
  }
  return nextRoot;
}

export function initialValueForSchema(schema: SchemaMeta): unknown {
  if (schema.secret) return undefined;
  if (schema.kind === "union") {
    const first = schema.options?.find((option) => !option.disabled) ?? schema.options?.[0];
    return first ? initialValueForSchema(first) : undefined;
  }
  if (schema.kind === "object") {
    if (schema.variantBy && schema.variants) {
      const variantField = ownProperty(schema.fields, schema.variantBy)?.schema;
      const defaultKey =
        variantField?.hasDefault && typeof variantField.defaultValue === "string"
          ? variantField.defaultValue
          : undefined;
      const firstKey =
        (defaultKey && ownProperty(schema.variants, defaultKey) && !ownProperty(schema.variants, defaultKey)?.disabled
          ? defaultKey
          : undefined) ??
        Object.entries(schema.variants).find(([, meta]) => !meta.disabled)?.[0] ??
        Object.keys(schema.variants)[0];
      const fields =
        firstKey !== undefined
          ? resolveObjectFields(schema, { [schema.variantBy]: firstKey })
          : (schema.fields ?? {});
      const result: Record<string, unknown> = {};
      if (firstKey !== undefined) result[schema.variantBy] = firstKey;
      for (const [key, field] of Object.entries(fields)) {
        if (key === schema.variantBy) continue;
        if (
          field.schema.secret ||
          field.schema.optional ||
          (field.schema.hasDefault && field.schema.kind !== "literal")
        ) {
          continue;
        }
        result[key] = initialValueForSchema(field.schema);
      }
      return result;
    }
    return Object.fromEntries(
      Object.entries(schema.fields ?? {}).flatMap(([key, field]) => {
        if (
          field.schema.secret ||
          field.schema.optional ||
          (field.schema.hasDefault && field.schema.kind !== "literal")
        ) {
          return [];
        }
        return [[key, initialValueForSchema(field.schema)]];
      }),
    );
  }
  if (schema.kind === "literal") return schema.value;
  if (schema.hasDefault) return cloneJsonValue(schema.defaultValue);
  if (schema.kind === "record") return {};
  if (schema.kind === "array" || schema.kind === "enum-set") return [];
  if (schema.kind === "number") return schema.min ?? 0;
  if (schema.kind === "boolean") return false;
  return "";
}
