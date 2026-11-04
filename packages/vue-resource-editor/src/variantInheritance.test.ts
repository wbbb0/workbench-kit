import { expect, it } from "vitest";
import { computeDraftEffectiveValue, computeDraftReferenceValue } from "./editorState.js";
import type { EditorModel } from "./types.js";

it("切换分支隔离内层参数，同分支局部覆盖保留继承与目标默认值", () => {
  const reference = { service: { provider: "first", enabled: true, config: { secret: "old", proxy: true, timeoutMs: 12000 } } };
  const model = {
    referenceValue: reference,
    schemaDefaultValue: { service: { provider: "first", config: {} } },
    editorFeatures: { draftEffectiveMode: "merge_reference", variantInheritance: [{
      path: ["service"], discriminator: "provider", settingsKey: "config", defaultVariant: "first",
      defaults: { first: { proxy: false, timeoutMs: 6000 }, second: { proxy: false, timeoutMs: 6000, model: "default" } }
    }] }
  } as unknown as EditorModel;
  const draft = { service: { provider: "second", config: { secret: "new" } } };
  expect(computeDraftEffectiveValue(model, draft)).toEqual({ service: { provider: "second", enabled: true, config: { secret: "new", proxy: false, timeoutMs: 6000, model: "default" } } });
  expect(computeDraftReferenceValue(model, draft)).toEqual({ service: { ...reference.service, config: {} } });
  expect(computeDraftEffectiveValue(model, { service: { config: { timeoutMs: 1000 } } })).toEqual({ service: { provider: "first", enabled: true, config: { secret: "old", proxy: true, timeoutMs: 1000 } } });
  expect(reference.service.config.secret).toBe("old");
});
