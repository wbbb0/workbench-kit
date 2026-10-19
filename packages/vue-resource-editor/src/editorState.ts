import { deepMerge } from "./deepMerge.js";
import type { EditorModel, EditorUnsetMode } from "./types.js";

export type PathSegment = string | number;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cloneValue<T>(value: T): T {
  return typeof globalThis.structuredClone === "function"
    ? globalThis.structuredClone(value)
    : JSON.parse(JSON.stringify(value)) as T;
}

export function deepEqual(left: unknown, right: unknown): boolean {
  if (left === right) {
    return true;
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) {
      return false;
    }
    return left.every((item, index) => deepEqual(item, right[index]));
  }
  if (isPlainObject(left) && isPlainObject(right)) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) {
      return false;
    }
    return leftKeys.every((key) => deepEqual(left[key], right[key]));
  }
  return false;
}

export function getValueAtPath(value: unknown, path: PathSegment[]): unknown {
  let current = value;
  for (const segment of path) {
    if (typeof segment === "number") {
      if (!Array.isArray(current)) {
        return undefined;
      }
      current = current[segment];
      continue;
    }
    if (!isPlainObject(current)) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

export function hasOwnValueAtPath(value: unknown, path: PathSegment[]): boolean {
  let current = value;
  for (const segment of path) {
    if (typeof segment === "number") {
      if (!Array.isArray(current) || segment < 0 || segment >= current.length) {
        return false;
      }
      current = current[segment];
      continue;
    }
    if (!isPlainObject(current) || !Object.prototype.hasOwnProperty.call(current, segment)) {
      return false;
    }
    current = current[segment];
  }
  return true;
}

function pruneValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value;
  }
  if (!isPlainObject(value)) {
    return value;
  }
  const next = Object.fromEntries(
    Object.entries(value)
      .map(([key, entryValue]) => [key, pruneValue(entryValue)])
      .filter(([, entryValue]) => entryValue !== undefined)
  );
  return Object.keys(next).length > 0 ? next : undefined;
}

export function removeValueAtPathAndPrune<T>(value: T, path: PathSegment[]): T | undefined {
  if (path.length === 0) {
    return undefined;
  }
  const cloned = cloneValue(value);
  let current: unknown = cloned;
  for (let index = 0; index < path.length - 1; index += 1) {
    const segment = path[index];
    if (segment === undefined) {
      return cloned;
    }
    if (typeof segment === "number") {
      if (!Array.isArray(current) || segment < 0 || segment >= current.length) {
        return cloned;
      }
      current = current[segment];
      continue;
    }
    if (!isPlainObject(current) || !Object.prototype.hasOwnProperty.call(current, segment)) {
      return cloned;
    }
    current = current[segment];
  }
  const lastSegment = path[path.length - 1];
  if (lastSegment === undefined) {
    return cloned;
  }
  if (typeof lastSegment === "number") {
    if (!Array.isArray(current) || lastSegment < 0 || lastSegment >= current.length) {
      return cloned;
    }
    current.splice(lastSegment, 1);
  } else if (isPlainObject(current) && Object.prototype.hasOwnProperty.call(current, lastSegment)) {
    delete current[lastSegment];
  } else {
    return cloned;
  }
  return pruneValue(cloned) as T | undefined;
}

export function canUnsetNodeValue(input: {
  unsetMode: EditorUnsetMode;
  schemaOptional: boolean;
  path: PathSegment[];
  modelValue: unknown;
}): boolean {
  if (input.path.length === 0 || input.modelValue === undefined) {
    return false;
  }
  if (input.unsetMode === "reference") {
    return true;
  }
  if (input.unsetMode === "optional") {
    return input.schemaOptional;
  }
  return false;
}

export function computeEffectiveValue(baseValue: unknown, draftValue: unknown): unknown {
  if (draftValue === undefined) {
    return baseValue;
  }
  return deepMerge(baseValue, draftValue);
}

function asObject(value: unknown): Record<string, unknown> {
  return isPlainObject(value) ? value : {};
}

function computeRecordInheritance(model: EditorModel, draftValue: unknown) {
  const inheritance = model.editorFeatures.recordInheritance;
  if (!inheritance) throw new Error("record_inheritance requires sourceKey and defaults");
  const draft = asObject(draftValue);
  const source = computeEffectiveValue(inheritance.defaults, asObject(draft[inheritance.sourceKey]));
  const reference: Record<string, unknown> = {};
  const effective: Record<string, unknown> = {};
  for (const key of new Set([inheritance.sourceKey, ...Object.keys(draft)])) {
    const isSource = key === inheritance.sourceKey;
    reference[key] = isSource ? {} : source;
    effective[key] = computeEffectiveValue(isSource ? inheritance.defaults : source, asObject(draft[key]));
  }
  return { reference, effective };
}

export function computeDraftReferenceValue(model: EditorModel, draftValue: unknown): unknown {
  switch (model.editorFeatures.draftEffectiveMode) {
    case "record_inheritance":
      return computeRecordInheritance(model, draftValue).reference;
    case "merge_reference":
    case "draft_only":
    default:
      return model.referenceValue;
  }
}

export function computeDraftEffectiveValue(model: EditorModel, draftValue: unknown): unknown {
  const referenceValue = computeDraftReferenceValue(model, draftValue);
  switch (model.editorFeatures.draftEffectiveMode) {
    case "merge_reference":
      return computeEffectiveValue(
        computeEffectiveValue(model.schemaDefaultValue, referenceValue),
        draftValue
      );
    case "record_inheritance":
      return computeRecordInheritance(model, draftValue).effective;
    case "draft_only":
    default:
      return draftValue;
  }
}
