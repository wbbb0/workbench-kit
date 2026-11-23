import type { SettingsActivationStatus } from "@workbench-kit/schema";
import { settingAt } from "./settingsPages.js";
import type { SchemaMeta } from "./types.js";

export interface SettingsActivationFeedback {
  activationStatus: SettingsActivationStatus;
  activationError?: string;
  restartRequiredPaths?: string[][];
  schema: SchemaMeta;
  effective: unknown;
}

export function settingsActivationMessage(snapshot?: SettingsActivationFeedback): string {
  switch (snapshot?.activationStatus) {
    case "apply_failed":
      return snapshot.activationError ?? "运行配置更新失败。";
    case "restart_required": {
      const paths = snapshot.restartRequiredPaths;
      if (!paths?.length || paths.some(path => path.length === 0)) {
        return "已保存配置将在重启服务后生效。";
      }
      const fields = paths.map(path =>
        settingAt(snapshot.schema, snapshot.effective, path)?.title ?? path.join("."),
      );
      return `其余配置已生效。${fields.join("、")}将在重启服务后生效。`;
    }
    case "pending":
      return "已保存配置等待服务加载。";
    default:
      return "";
  }
}
