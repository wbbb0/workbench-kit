import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { createMenuRuntime } from "./menuRuntime.js";
import type { MenuNode } from "./types.js";
import MenuList from "./MenuList.vue";

const runtime = createMenuRuntime();
vi.mock("./useMenuRuntime", async () => {
  const actual = await vi.importActual<typeof import("./useMenuRuntime")>("./useMenuRuntime");
  return { ...actual, useMenuRuntime: () => runtime };
});

describe("MenuList action transitions", () => {
  for (const kind of ["action", "toggle", "radio"] as const) {
    it(`keeps a new menu opened by a ${kind} callback`, async () => {
      runtime.openMenu({ id: "original", items: [], source: "topbar", anchor: { x: 0, y: 0 } });
      const select = () => runtime.openMenu({ id: "history", items: [], source: "topbar", anchor: { x: 0, y: 0 } });
      const item: MenuNode = kind === "toggle" ? { kind, id: "next", label: "Next", checked: false, onToggle: select }
        : kind === "radio" ? { kind, id: "next", label: "Next", checked: false, onSelect: select }
        : { kind, id: "next", label: "Next", onSelect: select };
      const wrapper = mount(MenuList, { props: { items: [item], menuId: "original", source: "topbar" } });
      await wrapper.get("button").trigger("click");
      expect(runtime.openMenus.value.map(menu => menu.id)).toEqual(["history"]);
      wrapper.unmount();
      runtime.closeAllMenus();
    });
  }
});
