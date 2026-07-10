import { inject, provide, type InjectionKey, type Ref } from "vue";
import type { WorkbenchAreaId } from "../types.js";
import { useWorkbenchRuntimeContext } from "./workbenchRuntime.js";

const workbenchAreaIdKey: InjectionKey<Readonly<Ref<WorkbenchAreaId>>> = Symbol("workbench-area-id");

export function provideWorkbenchAreaId(areaId: Readonly<Ref<WorkbenchAreaId>>): void {
  provide(workbenchAreaIdKey, areaId);
}

export function useDefaultWorkbenchSelectionNavigation(): () => void {
  const areaId = inject(workbenchAreaIdKey, null);
  const runtime = useWorkbenchRuntimeContext();

  return () => {
    if (areaId?.value !== "primarySidebar" || runtime?.mobileRootAreaId.value !== "primarySidebar") {
      return;
    }
    runtime.showArea("mainArea");
  };
}
