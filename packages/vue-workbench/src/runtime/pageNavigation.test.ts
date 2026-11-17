import { computed, defineComponent, effectScope, h, ref } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { defineWorkbenchView } from "../types";
import {
  createWorkbenchRuntime,
  activateWorkbenchRuntime,
  useWorkbenchNavigation,
} from "./workbenchRuntime";
import {
  type WorkbenchPageNavigation,
  type WorkbenchPageLocation,
} from "./pageNavigation";
import WorkbenchRuntimeRoot from "../WorkbenchRuntimeRoot.vue";
import MobileWorkbench from "../MobileWorkbench.vue";
const Area = { render: () => h("div", "页面内容") };
const makeView = (id = "test") =>
  defineWorkbenchView({
    id,
    title: id,
    areas: { primarySidebar: Area, mainArea: Area },
  });
const root: WorkbenchPageLocation = {
  key: "root",
  title: "分类",
  areaId: "primarySidebar",
};
const category: WorkbenchPageLocation = {
  key: "category",
  title: "分类详情",
  areaId: "mainArea",
};
const detail: WorkbenchPageLocation = {
  key: "detail",
  title: "条目",
  areaId: "mainArea",
};
function fixture() {
  const scope = effectScope();
  const view = ref(makeView());
  const path = ref([root, category, detail]);
  const navigate = vi.fn(async () => true);
  const binding = computed<WorkbenchPageNavigation>(() => ({
    viewId: view.value.id,
    path: path.value,
    navigate,
  }));
  const runtime = scope.run(() =>
    createWorkbenchRuntime(
      computed(() => view.value),
      binding,
    ),
  )!;
  return { scope, view, path, navigate, binding, runtime };
}
describe("受控页面导航", () => {
  it("直接深链接按结构返回父级，同区域导航不改写第二份栈", async () => {
    const f = fixture();
    try {
      expect(f.runtime.activeMobileAreaId.value).toBe("mainArea");
      await f.runtime.pages.back();
      expect(f.navigate).toHaveBeenCalledWith(category, { replace: true });
      expect(f.runtime.pages.current.value).toEqual(detail);
      f.path.value = [root, category];
      await f.runtime.pages.back();
      expect(f.navigate).toHaveBeenLastCalledWith(root, { replace: true });
      f.path.value = [root];
      expect(f.runtime.activeMobileAreaId.value).toBe("primarySidebar");
      expect(await f.runtime.pages.back()).toBe(false);
      expect(f.runtime.mobileAreaStack.value).toEqual([]);
    } finally {
      f.scope.stop();
    }
  });
  it("失败保留页面、阻止重复点击，切 view 不接受旧请求的反馈", async () => {
    const f = fixture();
    try {
      let reject!: (error: Error) => void;
      f.navigate.mockImplementation(
        () =>
          new Promise((_, fail) => {
            reject = fail;
          }),
      );
      const waiting = f.runtime.pages.back();
      expect(await f.runtime.pages.back()).toBe(false);
      expect(f.navigate).toHaveBeenCalledTimes(1);
      reject(new Error("导航失败"));
      await waiting;
      expect(f.runtime.pages.error.value).toBe("导航失败");
      expect(f.runtime.pages.current.value).toEqual(detail);
      const old = f.runtime.pages.back();
      f.view.value = makeView("other");
      reject(new Error("旧页面失败"));
      await old;
      expect(f.runtime.pages.error.value).toBe("");
      expect(f.runtime.pages.pending.value).toBe(false);
    } finally {
      f.scope.stop();
    }
  });
  it("未接入时保留区域导航", () => {
    const scope = effectScope();
    try {
      const runtime = scope.run(() =>
        createWorkbenchRuntime(computed(() => makeView())),
      )!;
      runtime.showArea("mainArea");
      expect(runtime.activeMobileAreaId.value).toBe("mainArea");
      expect(runtime.popMobileArea()).toBe(true);
      expect(runtime.activeMobileAreaId.value).toBe("primarySidebar");
    } finally {
      scope.stop();
    }
  });
  it("移动头部返回不写浏览器历史，popstate 不改变受控页面", async () => {
    const f = fixture();
    const push = vi.spyOn(window.history, "pushState");
    const w = mount(WorkbenchRuntimeRoot, {
      props: { view: f.view.value, pageNavigation: f.binding.value },
      slots: {
        default: () =>
          h(MobileWorkbench, {
            runtime: f.runtime,
            view: f.view.value,
            navItems: [],
            activeNavItemId: "test",
            topbarMenus: [],
            statusbarItems: [],
          }),
      },
    });
    try {
      await w.get('[aria-label="返回分类详情"]').trigger("click");
      expect(f.navigate).toHaveBeenCalledWith(category, { replace: true });
      window.dispatchEvent(new PopStateEvent("popstate"));
      expect(f.runtime.pages.current.value).toEqual(detail);
      expect(push).not.toHaveBeenCalled();
      f.path.value = [root];
      await flushPromises();
      expect(w.find('[aria-label="返回分类详情"]').exists()).toBe(false);
    } finally {
      w.unmount();
      push.mockRestore();
      f.scope.stop();
    }
  });
  it("注入 runtime 绑定不跟随另一个全局工作台，停用 view 回调失效", async () => {
    const f = fixture(),
      other = fixture();
    let navigation!: ReturnType<typeof useWorkbenchNavigation>;
    const Child = defineComponent({
      setup() {
        navigation = useWorkbenchNavigation();
        return () => h("div");
      },
    });
    const w = mount(WorkbenchRuntimeRoot, {
      props: { view: f.view.value, pageNavigation: f.binding.value },
      slots: { default: () => h(Child) },
    });
    const release = activateWorkbenchRuntime(other.runtime);
    try {
      await navigation.backPage();
      expect(f.navigate).toHaveBeenCalledTimes(1);
      expect(other.navigate).not.toHaveBeenCalled();
      await w.setProps({ view: makeView("other") });
      expect(await navigation.backPage()).toBe(false);
    } finally {
      release();
      w.unmount();
      f.scope.stop();
      other.scope.stop();
    }
  });
});
