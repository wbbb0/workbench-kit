import type { SchemaMeta } from "./types.js";
import {
  isPlainObject,
  ownProperty,
  resolveObjectFields,
  resolveObjectVariant,
  resolveObjectVariantKey,
  resolveSchemaBranch,
} from "./traversal.js";

const pointer = (path: readonly string[]) => JSON.stringify(path);

function setOwnProperty(
  target: Record<string, unknown>,
  key: string,
  value: unknown,
) {
  Object.defineProperty(target, key, {
    value,
    enumerable: true,
    writable: true,
    configurable: true,
  });
}

function combinedUnionFields(schema: SchemaMeta) {
  const fields: Record<string, { schema: SchemaMeta }> = { ...(schema.fields ?? {}) };
  for (const option of schema.options ?? []) {
    if (option.fields) Object.assign(fields, option.fields);
  }
  return fields;
}

export function redactSecrets(
  schema: SchemaMeta,
  value: unknown,
  path: string[],
  secrets: Record<string, boolean>,
): unknown {
  if (schema.secret) {
    secrets[pointer(path)] = typeof value === "string" && value.length > 0;
    return undefined;
  }
  const branch = resolveSchemaBranch(schema, value);
  if (branch !== schema) {
    return redactSecrets(branch, value, path, secrets);
  }
  if (Array.isArray(value) && schema.kind === "array" && schema.item) {
    return value.map((item, index) =>
      redactSecrets(schema.item!, item, [...path, String(index)], secrets),
    );
  }
  if (isPlainObject(value)) {
    // 即使外部文件分支无效或 toggleField 关闭，也从所有声明分支识别秘密；未声明值不回传。
    const fields =
      schema.kind === "union"
        ? combinedUnionFields(schema)
        : resolveObjectFields(schema, value, { allVariants: true });
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      const childSchema = schema.recordValue ?? ownProperty(fields, key)?.schema;
      if (!childSchema) continue;
      const cleaned = redactSecrets(childSchema, child, [...path, key], secrets);
      if (cleaned !== undefined) {
        setOwnProperty(result, key, cleaned);
      }
    }
    return result;
  }
  return value;
}

export function collectSecretPaths(
  schema: SchemaMeta,
  value: unknown,
  path: string[] = [],
): string[][] {
  if (schema.secret) return [path];
  const selected = resolveSchemaBranch(schema, value);
  if (selected !== schema) {
    return collectSecretPaths(selected, value, path);
  }
  if (Array.isArray(value) && schema.kind === "array" && schema.item) {
    return value.flatMap((item, index) =>
      collectSecretPaths(schema.item!, item, [...path, String(index)]),
    );
  }
  if (!isPlainObject(value)) return [];
  const fields = resolveObjectFields(schema, value, { allVariants: true });
  return Object.entries(value).flatMap(([key, child]) => {
    const field = schema.recordValue ?? ownProperty(fields, key)?.schema;
    return field ? collectSecretPaths(field, child, [...path, key]) : [];
  });
}

export function preserveSecrets(
  schema: SchemaMeta,
  before: unknown,
  after: unknown,
): unknown {
  if (schema.secret) return before;
  const oldBranch = resolveSchemaBranch(schema, before);
  const newBranch = resolveSchemaBranch(schema, after);
  if (oldBranch !== newBranch) return after;
  if (newBranch !== schema) return preserveSecrets(newBranch, before, after);
  if (Array.isArray(before) && Array.isArray(after) && schema.kind === "array" && schema.item) {
    return after.map((item, index) =>
      index < before.length ? preserveSecrets(schema.item!, before[index], item) : item,
    );
  }
  if (!isPlainObject(before) || !isPlainObject(after)) return after;

  if (schema.variantBy && schema.variants) {
    const oldKey = resolveObjectVariantKey(schema, before);
    const newKey = resolveObjectVariantKey(schema, after);
    const sameVariant = oldKey === newKey;
    const allowedFields = sameVariant
      ? resolveObjectFields(schema, after)
      : (schema.fields ?? {});
    for (const [key, oldValue] of Object.entries(before)) {
      const childSchema = ownProperty(allowedFields, key)?.schema;
      if (!childSchema || (!childSchema.secret && !Object.hasOwn(after, key))) {
        continue;
      }
      const next = preserveSecrets(childSchema, oldValue, after[key]);
      if (next !== undefined) setOwnProperty(after, key, next);
    }
    return after;
  }

  const fields = schema.fields ?? {};
  for (const [key, oldValue] of Object.entries(before)) {
    const childSchema = schema.recordValue ?? ownProperty(fields, key)?.schema;
    if (!childSchema || (!childSchema.secret && !Object.hasOwn(after, key))) {
      continue;
    }
    const next = preserveSecrets(childSchema, oldValue, after[key]);
    if (next !== undefined) setOwnProperty(after, key, next);
  }
  return after;
}

function candidateFieldSchemas(
  schema: SchemaMeta,
  value: Record<string, unknown>,
  key: string,
): SchemaMeta[] {
  if (schema.recordValue) return [schema.recordValue];
  if (schema.variantBy && schema.variants) {
    const active = resolveObjectVariant(schema, value);
    if (active) {
      const field = ownProperty(resolveObjectFields(schema, value), key)?.schema;
      return field ? [field] : [];
    }
    const schemas: SchemaMeta[] = [];
    const base = ownProperty(schema.fields, key)?.schema;
    if (base) schemas.push(base);
    for (const variant of Object.values(schema.variants)) {
      const vField = ownProperty(variant.fields, key)?.schema;
      if (vField) schemas.push(vField);
    }
    return schemas;
  }
  const field = ownProperty(schema.fields, key)?.schema;
  return field ? [field] : [];
}

export function renameSchemaReferences(
  schema: SchemaMeta,
  value: unknown,
  target: readonly string[],
  oldName: string,
  name: string,
): unknown {
  if (
    schema.reference &&
    JSON.stringify(schema.reference.path) === JSON.stringify(target) &&
    value === oldName
  ) {
    return name;
  }
  const branch = resolveSchemaBranch(schema, value);
  if (branch !== schema) {
    return renameSchemaReferences(branch, value, target, oldName, name);
  }
  if (Array.isArray(value) && schema.kind === "array" && schema.item) {
    return value.map((item) =>
      renameSchemaReferences(schema.item!, item, target, oldName, name),
    );
  }
  if (!isPlainObject(value)) return value;
  for (const [key, child] of Object.entries(value)) {
    const schemas = candidateFieldSchemas(schema, value, key);
    let nextChild = child;
    for (const childSchema of schemas) {
      nextChild = renameSchemaReferences(childSchema, nextChild, target, oldName, name);
    }
    if (schemas.length) setOwnProperty(value, key, nextChild);
  }
  return value;
}
