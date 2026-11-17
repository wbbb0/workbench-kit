import { reactive } from "vue";
/** 可选的宿主页状态：跨布局重建保留位置和临时控件输入，不持久化。 */
export function createSettingsPageState() {
  return reactive({
    positions: new Map<string, number>(),
    names: {} as Record<string, string>,
    query: "",
  });
}
export type SettingsPageState = ReturnType<typeof createSettingsPageState>;
