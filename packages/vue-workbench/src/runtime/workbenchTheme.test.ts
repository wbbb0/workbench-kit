import { afterEach, describe, expect, it, vi } from "vitest";
import { initWorkbenchTheme, useWorkbenchTheme } from "./workbenchTheme.js";

function createMatchMediaStub(initialDark: boolean) {
  const target = new EventTarget() as EventTarget & { matches: boolean };
  target.matches = initialDark;
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => target),
  );
  return target;
}

describe("workbenchTheme", () => {
  let controller: ReturnType<typeof initWorkbenchTheme> | undefined;

  afterEach(() => {
    controller?.stop();
    controller = undefined;
    vi.unstubAllGlobals();
    window.localStorage.clear();
    delete document.documentElement.dataset.theme;
    delete document.documentElement.dataset.palette;
    document.documentElement.style.colorScheme = "";
  });

  it("默认跟随系统亮暗偏好并响应实时切换，stop 后停止监听", () => {
    const preference = createMatchMediaStub(false);
    controller = initWorkbenchTheme();

    expect(controller.mode.value).toBe("system");
    expect(controller.resolvedTheme.value).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.style.colorScheme).toBe("light");

    preference.matches = true;
    preference.dispatchEvent(new Event("change"));
    expect(controller.resolvedTheme.value).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");

    controller.stop();
    preference.matches = false;
    preference.dispatchEvent(new Event("change"));
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("支持 setMode、toggle 与重新切回 system", () => {
    const preference = createMatchMediaStub(true);
    controller = initWorkbenchTheme();

    expect(controller.resolvedTheme.value).toBe("dark");
    controller.toggle();
    expect(controller.mode.value).toBe("light");
    expect(controller.resolvedTheme.value).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");

    controller.setMode("system");
    expect(controller.mode.value).toBe("system");
    expect(controller.resolvedTheme.value).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");

    preference.matches = false;
    preference.dispatchEvent(new Event("change"));
    expect(controller.resolvedTheme.value).toBe("light");
  });

  it("支持 localStorage 持久化、palette 切换与 useWorkbenchTheme 共享访问", () => {
    createMatchMediaStub(false);
    controller = initWorkbenchTheme({
      palette: "neutral",
      storageKey: "wb-test-mode",
      paletteStorageKey: "wb-test-palette",
    });

    expect(useWorkbenchTheme()).toBe(controller);
    expect(document.documentElement.dataset.palette).toBe("neutral");

    controller.setMode("dark");
    controller.setPalette("midnight");
    expect(window.localStorage.getItem("wb-test-mode")).toBe("dark");
    expect(window.localStorage.getItem("wb-test-palette")).toBe("midnight");
    expect(document.documentElement.dataset.palette).toBe("midnight");

    controller = initWorkbenchTheme({
      storageKey: "wb-test-mode",
      paletteStorageKey: "wb-test-palette",
    });
    expect(controller.mode.value).toBe("dark");
    expect(controller.resolvedTheme.value).toBe("dark");
    expect(controller.palette.value).toBe("midnight");

    controller.setPalette(undefined);
    expect(document.documentElement.dataset.palette).toBeUndefined();
    expect(window.localStorage.getItem("wb-test-palette")).toBeNull();
  });

  it("重复调用 initWorkbenchTheme 会清理前一次监听，在无 document 环境也不会崩溃", () => {
    const preference = createMatchMediaStub(false);
    const first = initWorkbenchTheme();
    const second = initWorkbenchTheme();
    controller = second;

    expect(first.mode.value).toBe("system");
    first.stop();
    preference.matches = true;
    preference.dispatchEvent(new Event("change"));
    expect(second.resolvedTheme.value).toBe("dark");
  });
});
