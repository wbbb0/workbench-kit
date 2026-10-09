import { mount, type VueWrapper } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WorkbenchBreadcrumbs from "./WorkbenchBreadcrumbs.vue";

const { openMenu } = vi.hoisted(() => ({ openMenu: vi.fn() }));
vi.mock("../menu/useMenuRuntime.js", () => ({ useMenuRuntime: () => ({ openMenu }) }));

describe("width-aware breadcrumbs", () => {
  let available: number;
  let resize: () => void;
  let disconnect: ReturnType<typeof vi.fn>;
  const wrappers: VueWrapper[] = [];
  const items = ["Home", "Workspace", "ML", "moduledModels"].map(label => ({ label, onSelect: vi.fn() }));
  beforeEach(() => {
    available = 500;
    disconnect = vi.fn();
    openMenu.mockReset();
    vi.stubGlobal("ResizeObserver", class {
      constructor(callback: () => void) { resize = callback; }
      observe() {}
      disconnect = disconnect;
    });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const width = this.tagName === "NAV" ? available
        : this.hasAttribute("data-breadcrumb-measure-item") ? (this.firstElementChild?.textContent?.length ?? 0) * 8 + 12
        : this.hasAttribute("data-breadcrumb-measure-overflow") ? 36 : 0;
      return { width, height: 24, left: 0, right: width, top: 0, bottom: 24, x: 0, y: 0, toJSON() {} };
    });
    const originalStyle = getComputedStyle;
    vi.stubGlobal("getComputedStyle", (element: Element) => element.hasAttribute("inert")
      ? { columnGap: "4px" } : originalStyle(element));
  });
  afterEach(() => {
    wrappers.splice(0).forEach(wrapper => wrapper.unmount());
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  function render(props = {}) {
    const wrapper = mount(WorkbenchBreadcrumbs, { props: { items, autoCollapse: true, ...props } });
    wrappers.push(wrapper);
    return wrapper;
  }
  function labels(wrapper: VueWrapper) {
    return wrapper.findAll("button:not([aria-haspopup])").map(button => button.text());
  }
  it("expands the full path when it fits and keeps as many trailing ancestors as fit on resize", async () => {
    const wrapper = render();
    await nextTick();
    expect(labels(wrapper)).toEqual(items.map(item => item.label));
    expect(wrapper.find('[aria-haspopup="menu"]').exists()).toBe(false);
    available = 250; resize(); await nextTick();
    expect(labels(wrapper)).toEqual(["Home", "ML", "moduledModels"]);
    available = 120; resize(); await nextTick();
    expect(labels(wrapper)).toEqual(["Home", "moduledModels"]);
    expect(wrapper.get("button").classes()).toContain("min-w-0");
    available = 500; resize(); await nextTick();
    expect(labels(wrapper)).toEqual(items.map(item => item.label));
  });
  it("remeasures changed labels and handles an initially empty path", async () => {
    const wrapper = render({ items: [] });
    expect(wrapper.find("nav").exists()).toBe(false);
    await wrapper.setProps({ items }); await nextTick();
    expect(labels(wrapper)).toEqual(items.map(item => item.label));
    await wrapper.setProps({ items: items.map((item, index) => ({ ...item, label: index === 3 ? "Very long current directory ".repeat(4) : item.label })) });
    await nextTick();
    expect(labels(wrapper)).toHaveLength(2);
    await wrapper.setProps({ items }); await nextTick();
    expect(labels(wrapper)).toHaveLength(4);
  });
  it("keeps explicit maxItems as an upper bound and can return to legacy behavior", async () => {
    const wrapper = render({ maxItems: 3 }); await nextTick();
    expect(labels(wrapper)).toEqual(["Home", "ML", "moduledModels"]);
    available = 120; resize(); await nextTick();
    expect(labels(wrapper)).toEqual(["Home", "moduledModels"]);
    await wrapper.setProps({ autoCollapse: false }); await nextTick();
    expect(labels(wrapper)).toEqual(["Home", "ML", "moduledModels"]);
    expect(wrapper.find("[inert]").exists()).toBe(false);
    await wrapper.setProps({ maxItems: undefined });
    expect(labels(wrapper)).toHaveLength(4);
  });
  it("keeps collapsed ancestor navigation in the menu and the measuring layer inert and noninteractive", async () => {
    available = 120;
    const wrapper = render(); await nextTick();
    const layer = wrapper.get('[aria-hidden="true"][inert]');
    expect(layer.find("a, button, input, [tabindex]").exists()).toBe(false);
    await wrapper.get('[aria-haspopup="menu"]').trigger("click");
    const menuItems = openMenu.mock.calls[0]![0].items;
    expect(menuItems.map((item: {label:string}) => item.label)).toEqual(["Workspace", "ML"]);
    menuItems[0].onSelect();
    expect(items[1]!.onSelect).toHaveBeenCalledOnce();
    wrapper.unmount(); wrappers.pop();
    expect(disconnect).toHaveBeenCalled();
  });
});
