import {
  isObjectToggleActive,
  isPlainObject,
  ownProperty,
  resolveObjectFields,
  resolveObjectVariantKey,
} from "./traversal.js";
import type { ActivationSchema } from "./types.js";

function equal(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((entry, index) => equal(entry, right[index]))
    );
  }
  if (!isPlainObject(left) || !isPlainObject(right)) return false;
  const keys = Object.keys(left);
  return (
    keys.length === Object.keys(right).length &&
    keys.every(
      (key) => Object.hasOwn(right, key) && equal(left[key], right[key]),
    )
  );
}

/** Combine validated JSON trees. Treat returned values and inputs as immutable. */
export function planSettingsActivation<T>(
  schema: ActivationSchema,
  startup: T,
  published: T,
): { effective: T; restartRequiredPaths: string[][] } {
  const restartRequiredPaths: string[][] = [];
  const restartDescendants = new WeakMap<ActivationSchema, boolean>();

  function hasRestart(node: ActivationSchema): boolean {
    const cached = restartDescendants.get(node);
    if (cached !== undefined) return cached;
    const result =
      node.activation === "restart" ||
      Object.values(node.fields ?? {}).some((field) => hasRestart(field.schema)) ||
      Object.values(node.variants ?? {}).some((variant) =>
        Object.values(variant.fields ?? {}).some((field) =>
          hasRestart(field.schema),
        ),
      ) ||
      (node.item !== undefined && hasRestart(node.item)) ||
      (node.recordValue !== undefined && hasRestart(node.recordValue)) ||
      (node.options?.some(hasRestart) ?? false);
    restartDescendants.set(node, result);
    return result;
  }

  function apply(
    node: ActivationSchema | undefined,
    before: unknown,
    after: unknown,
    path: string[],
  ): unknown {
    if (!node || !hasRestart(node)) return after;

    if (
      node.activation !== "restart" &&
      node.kind === "object" &&
      node.toggleField &&
      isPlainObject(before) &&
      isPlainObject(after)
    ) {
      const beforeActive = isObjectToggleActive(node as never, before);
      const afterActive = isObjectToggleActive(node as never, after);
      if (!beforeActive && !afterActive) {
        return after;
      }
    }

    if (
      node.activation !== "restart" &&
      node.kind === "object" &&
      node.variantBy &&
      node.variants &&
      isPlainObject(before) &&
      isPlainObject(after)
    ) {
      const beforeVariant = resolveObjectVariantKey(node as never, before);
      const afterVariant = resolveObjectVariantKey(node as never, after);
      if (beforeVariant !== afterVariant) {
        restartRequiredPaths.push(path);
        return before;
      }
    }

    // Only merge object fields and stable record keys. Other shapes have no stable child identity.
    if (
      node.activation !== "restart" &&
      (node.kind === "object" || node.kind === "record") &&
      isPlainObject(before) &&
      isPlainObject(after)
    ) {
      const objectFields =
        node.kind === "object"
          ? resolveObjectFields(node as never, after)
          : undefined;
      const keys = new Set([...Object.keys(after), ...Object.keys(before)]);
      const entries = [];
      for (const key of keys) {
        const child =
          node.kind === "record"
            ? node.recordValue
            : (ownProperty(objectFields, key)?.schema as
                | ActivationSchema
                | undefined);
        const value = apply(
          child,
          ownProperty(before, key),
          ownProperty(after, key),
          [...path, key],
        );
        if (value !== undefined) entries.push([key, value]);
      }
      return Object.fromEntries(entries);
    }

    if (equal(before, after)) return after;
    restartRequiredPaths.push(path);
    return before;
  }

  return {
    effective: apply(schema, startup, published, []) as T,
    restartRequiredPaths,
  };
}
