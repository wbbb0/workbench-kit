import { describe, expect, it } from "vitest";
import { computeDraftEffectiveValue, computeDraftReferenceValue } from "./editorState.js";
import type { EditorModel } from "./types.js";

describe("generic record inheritance", () => {
  const model = {
    editorFeatures: { draftEffectiveMode: "record_inheritance", recordInheritance: { sourceKey: "base", defaults: { targets: [], settings: { a: 1, b: 2 } } } }
  } as unknown as EditorModel;
  it("inherits arbitrary new fields and preserves explicit empty arrays", () => {
    const draft = { base: { targets: ["one"], futureField: ["new"], settings: { a: 3 } }, child: { targets: [], settings: { b: 4 } } };
    expect(computeDraftReferenceValue(model, draft)).toEqual({ base: {}, child: { targets: ["one"], futureField: ["new"], settings: { a: 3, b: 2 } } });
    expect(computeDraftEffectiveValue(model, draft)).toEqual({
      base: { targets: ["one"], futureField: ["new"], settings: { a: 3, b: 2 } },
      child: { targets: [], futureField: ["new"], settings: { a: 3, b: 4 } }
    });
  });
  it("supplies source defaults when the source entry is absent", () => {
    expect(computeDraftEffectiveValue(model, { child: {} })).toEqual({ base: { targets: [], settings: { a: 1, b: 2 } }, child: { targets: [], settings: { a: 1, b: 2 } } });
  });
});
