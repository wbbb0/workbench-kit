import { inject, provide, type InjectionKey, type Ref } from "vue";
import type { WorkbenchAreaId } from "../types.js";
import type { WorkbenchPageLocation } from "./pageNavigation.js";
import { useWorkbenchRuntimeContext } from "./workbenchRuntime.js";

const workbenchAreaIdKey: InjectionKey<Readonly<Ref<WorkbenchAreaId>>> =
  Symbol("workbench-area-id");

export function provideWorkbenchAreaId(
  areaId: Readonly<Ref<WorkbenchAreaId>>,
): void {
  provide(workbenchAreaIdKey, areaId);
}

interface WorkbenchAreaPresentation {
  active: Readonly<Ref<boolean>>;
  leavingPath: Readonly<Ref<readonly WorkbenchPageLocation[] | undefined>>;
}

const presentationKey: InjectionKey<WorkbenchAreaPresentation> = Symbol(
  "workbench-area-presentation",
);

export function provideWorkbenchAreaPresentation(
  presentation: WorkbenchAreaPresentation,
) {
  provide(presentationKey, presentation);
}

/** 区域实例的活动状态与仅供退出画面读取的原页面链。 */
export function useWorkbenchAreaPresentation() {
  return inject(presentationKey, undefined);
}
export function useWorkbenchLeavingPath() {
  return useWorkbenchAreaPresentation()?.leavingPath;
}

export function useDefaultWorkbenchSelectionNavigation(): () => void {
  const areaId = inject(workbenchAreaIdKey, null);
  const runtime = useWorkbenchRuntimeContext();

  return () => {
    if (
      runtime?.pages.controlled.value ||
      areaId?.value !== "primarySidebar" ||
      runtime?.mobileRootAreaId.value !== "primarySidebar"
    ) {
      return;
    }
    runtime.showArea("mainArea");
  };
}
