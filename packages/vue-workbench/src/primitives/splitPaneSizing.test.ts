import { describe, expect, it } from "vitest";
import {
  applySplitPaneDividerDelta,
  commitDividerPreferences,
  createSplitPaneSizingSignature,
  getSplitPaneDividerRange,
  reconcilePreferredSizes,
  resolvePaneSizes
} from "./splitPaneSizing";
import type { ResponsiveSplitPaneItem } from "./responsiveSplitPaneTypes";

const panes: readonly ResponsiveSplitPaneItem[] = [
  {
    id: "left",
    defaultSize: 300,
    minSize: 200,
    maxSize: 500,
    grow: 0,
    shrinkPriority: 100
  },
  {
    id: "center",
    defaultSize: 400,
    minSize: 200,
    maxSize: 800,
    grow: 1,
    growPriority: 100,
    shrinkPriority: 0
  },
  {
    id: "right",
    defaultSize: 300,
    minSize: 200,
    maxSize: 500,
    grow: 0,
    shrinkPriority: 100
  }
];

describe("split pane sizing", () => {
  it("reconciles stable ids and clamps changed constraints", () => {
    expect(reconcilePreferredSizes(
      [panes[0]!, { ...panes[2]!, maxSize: 280 }, { id: "new", defaultSize: 150 }],
      { left: 350, center: 450, right: 320 },
      "horizontal"
    )).toEqual({ left: 350, right: 280, new: 150 });
  });

  it("invalidates anchors only for sizing-relevant pane changes", () => {
    const base = [{ id: "one", label: "One", minSize: 100, tabDisabled: false }];
    expect(createSplitPaneSizingSignature([
      { ...base[0]!, label: "Uno", title: "Translated", tabDisabled: true }
    ])).toBe(createSplitPaneSizingSignature(base));
    expect(createSplitPaneSizingSignature([
      { ...base[0]!, minSize: 120 }
    ])).not.toBe(createSplitPaneSizingSignature(base));
    expect(createSplitPaneSizingSignature([
      { id: "two" },
      ...base
    ])).not.toBe(createSplitPaneSizingSignature(base));
  });

  it("allocates growth and shrink by priority without changing preferred sizes", () => {
    const preferred = { left: 300, center: 400, right: 300 };
    expect(resolvePaneSizes(panes, preferred, 1200, "horizontal")).toEqual({
      left: 300,
      center: 600,
      right: 300
    });
    expect(resolvePaneSizes(panes, preferred, 800, "horizontal")).toEqual({
      left: 300,
      center: 200,
      right: 300
    });
    expect(preferred).toEqual({ left: 300, center: 400, right: 300 });
  });

  it("returns to the same layout after a shrink-expand round trip", () => {
    const preferred = { left: 400, center: 500, right: 300 };
    const initial = resolvePaneSizes(panes, preferred, 1200, "horizontal");
    resolvePaneSizes(panes, preferred, 800, "horizontal");
    const restored = resolvePaneSizes(panes, preferred, 1200, "horizontal");
    expect(restored).toEqual(initial);
  });

  it("handles min overflow and max-size trailing space", () => {
    expect(resolvePaneSizes(panes, {}, 300, "horizontal")).toEqual({
      left: 200,
      center: 200,
      right: 200
    });
    expect(resolvePaneSizes(panes, {}, 2000, "horizontal")).toEqual({
      left: 300,
      center: 800,
      right: 300
    });
  });

  it("uses weights within the same growth priority", () => {
    const weighted: readonly ResponsiveSplitPaneItem[] = [
      { id: "a", defaultSize: 100, grow: 1, growPriority: 10 },
      { id: "b", defaultSize: 100, grow: 3, growPriority: 10 }
    ];
    expect(resolvePaneSizes(weighted, {}, 600, "horizontal")).toEqual({ a: 200, b: 400 });
  });

  it("resizes adjacent panes first and cascades after constraints", () => {
    const start = { left: 300, center: 400, right: 300 };
    const result = applySplitPaneDividerDelta(panes, start, 0, 250);
    expect(result.sizes).toEqual({ left: 500, center: 200, right: 300 });
    expect(result.changedPaneIds).toEqual(["left", "center"]);
  });

  it("keeps untouched preferences when a constrained layout is dragged", () => {
    const preferred = { left: 400, center: 500, right: 300 };
    const constrained = resolvePaneSizes(panes, preferred, 900, "horizontal");
    const result = applySplitPaneDividerDelta(panes, constrained, 1, 50);
    const committed = commitDividerPreferences(panes, preferred, result, "horizontal");
    expect(committed.left).toBe(400);
    expect(committed.center).toBe(result.sizes.center);
    expect(committed.right).toBe(result.sizes.right);
    const anchor = { sizes: result.sizes };
    expect(resolvePaneSizes(panes, committed, 900, "horizontal", anchor)).toEqual(result.sizes);
    expect(resolvePaneSizes(panes, committed, 1200, "horizontal", anchor)).toEqual({
      left: 400,
      center: 550,
      right: 250
    });
  });

  it("computes a finite reachable divider range from the layout extent", () => {
    expect(getSplitPaneDividerRange(
      panes,
      { left: 300, center: 400, right: 300 },
      1
    )).toEqual({ min: 500, now: 700, max: 800 });
  });

  it("supports four panes and both divider directions", () => {
    const four: readonly ResponsiveSplitPaneItem[] = [
      { id: "a", minSize: 100, maxSize: 300 },
      { id: "b", minSize: 100, maxSize: 300 },
      { id: "c", minSize: 100, maxSize: 300 },
      { id: "d", minSize: 100, maxSize: 300 }
    ];
    const start = { a: 200, b: 200, c: 200, d: 200 };
    expect(applySplitPaneDividerDelta(four, start, 1, 150).sizes).toEqual({
      a: 250,
      b: 300,
      c: 100,
      d: 150
    });
    expect(applySplitPaneDividerDelta(four, start, 1, -150).sizes).toEqual({
      a: 150,
      b: 100,
      c: 300,
      d: 250
    });
  });

  it("anchors an exact constrained drag while restoring untouched preferences on expansion", () => {
    const four: readonly ResponsiveSplitPaneItem[] = [
      { id: "a", minSize: 100, maxSize: 500, grow: 0, shrinkPriority: 100 },
      { id: "b", minSize: 100, maxSize: 700, grow: 1, growPriority: 100, shrinkPriority: 0 },
      { id: "c", minSize: 100, maxSize: 500, grow: 0, shrinkPriority: 100 },
      { id: "d", minSize: 100, maxSize: 500, grow: 0, shrinkPriority: 50 }
    ];
    const preferred = { a: 350, b: 550, c: 300, d: 250 };
    const constrained = resolvePaneSizes(four, preferred, 450, "horizontal");
    const result = applySplitPaneDividerDelta(four, constrained, 0, -100);
    const committed = commitDividerPreferences(four, preferred, result, "horizontal");
    const anchor = { sizes: result.sizes };
    expect(resolvePaneSizes(four, committed, 450, "horizontal", anchor)).toEqual(result.sizes);
    const expanded = resolvePaneSizes(four, committed, 1000, "horizontal", anchor);
    expect(expanded.c).toBe(300);
    expect(expanded.d).toBe(250);
  });
});
