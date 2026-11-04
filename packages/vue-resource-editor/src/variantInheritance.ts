import { deepMerge } from "./deepMerge.js";
import type { EditorModel } from "./types.js";

type ObjectValue = Record<string, unknown>;
function object(value: unknown): ObjectValue {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as ObjectValue : {};
}
function at(value: unknown, path: string[]): ObjectValue {
  for (const key of path) value = object(value)[key];
  return object(value);
}
function withSettings(value: unknown, path: string[], key: string, settings: unknown): unknown {
  if (path.length === 0) return { ...object(value), [key]: settings };
  const [head, ...tail] = path;
  return { ...object(value), [head!]: withSettings(object(value)[head!], tail, key, settings) };
}

/** 不修改原对象，隔离不同分支的专属参数，并使用目标分支默认值。 */
export function applyVariantInheritance(model: EditorModel, draft: unknown): { reference: unknown; effective: unknown } {
  let reference = model.referenceValue;
  let effective = deepMerge(deepMerge(model.schemaDefaultValue, reference), draft);
  for (const rule of model.editorFeatures.variantInheritance ?? []) {
    const base = at(model.referenceValue, rule.path);
    const local = at(draft, rule.path);
    const baseVariant = base[rule.discriminator] ?? rule.defaultVariant;
    const variant = local[rule.discriminator] ?? baseVariant;
    const inherited = variant === baseVariant ? base[rule.settingsKey] : undefined;
    const settings = deepMerge(deepMerge(rule.defaults[String(variant)], inherited), local[rule.settingsKey]);
    effective = withSettings(effective, rule.path, rule.settingsKey, settings);
    if (variant !== baseVariant) reference = withSettings(reference, rule.path, rule.settingsKey, {});
  }
  return { reference, effective };
}
