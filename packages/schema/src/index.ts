/** Marker consumed by the runtime when applying a published configuration. */
export interface ActivationPolicy {
  activation?: "live" | "restart";
}

/** Structural subset shared by runtime schemas and editor metadata. */
export interface ActivationSchema extends ActivationPolicy {
  kind: string;
  fields?: Readonly<Record<string, { schema: ActivationSchema }>>;
  item?: ActivationSchema;
  recordValue?: ActivationSchema;
  options?: readonly ActivationSchema[];
}

export type SettingsActivationStatus = "active" | "pending" | "restart_required" | "apply_failed";

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function own<T>(record: Readonly<Record<string, T>> | undefined, key: string): T | undefined {
  return record && Object.hasOwn(record, key) ? record[key] : undefined;
}

function equal(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((entry, index) => equal(entry, right[index]));
  }
  if (!isObject(left) || !isObject(right)) return false;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length &&
    keys.every(key => Object.hasOwn(right, key) && equal(left[key], right[key]));
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
    const result = node.activation === "restart" ||
      Object.values(node.fields ?? {}).some(field => hasRestart(field.schema)) ||
      (node.item !== undefined && hasRestart(node.item)) ||
      (node.recordValue !== undefined && hasRestart(node.recordValue)) ||
      (node.options?.some(hasRestart) ?? false);
    restartDescendants.set(node, result);
    return result;
  }

  function apply(node: ActivationSchema | undefined, before: unknown, after: unknown, path: string[]): unknown {
    if (!node || !hasRestart(node)) return after;

    // Only merge object fields and stable record keys. Other shapes have no stable child identity.
    if (node.activation !== "restart" && (node.kind === "object" || node.kind === "record") &&
        isObject(before) && isObject(after)) {
      const keys = new Set([...Object.keys(after), ...Object.keys(before)]);
      const entries = [];
      for (const key of keys) {
        const child = node.kind === "record" ? node.recordValue : own(node.fields, key)?.schema;
        const value = apply(child, own(before, key), own(after, key), [...path, key]);
        if (value !== undefined) entries.push([key, value]);
      }
      return Object.fromEntries(entries);
    }

    if (equal(before, after)) return after;
    restartRequiredPaths.push(path);
    return before;
  }

  return { effective: apply(schema, startup, published, []) as T, restartRequiredPaths };
}
