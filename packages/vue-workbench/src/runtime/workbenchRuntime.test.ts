import { describe, expect, it } from "vitest";
import {
  getWorkbenchDesktopAreaSizeRange,
  type WorkbenchRuntime
} from "./workbenchRuntime";

describe("getWorkbenchDesktopAreaSizeRange", () => {
  it("derives an accurate fallback from legacy runtime clamping", () => {
    const runtime = {
      clampDesktopAreaSize: (_areaId: string, size: number) => Math.min(520, Math.max(180, size))
    } as unknown as WorkbenchRuntime;
    expect(getWorkbenchDesktopAreaSizeRange(runtime, "primarySidebar")).toEqual({
      min: 180,
      max: 520
    });
  });

  it("uses an explicit range when the runtime provides one", () => {
    const runtime = {
      clampDesktopAreaSize: () => 0,
      getDesktopAreaSizeRange: () => ({ min: 220, max: 640 })
    } as unknown as WorkbenchRuntime;
    expect(getWorkbenchDesktopAreaSizeRange(runtime, "secondarySidebar")).toEqual({
      min: 220,
      max: 640
    });
  });
});
