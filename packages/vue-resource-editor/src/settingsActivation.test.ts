import { describe, expect, it } from "vitest";
import { settingsActivationMessage } from "./settingsActivation.js";
import type { SchemaMeta } from "./types.js";

const schema: SchemaMeta = {
  kind: "object", optional: false, hasDefault: false,
  fields: { host: { schema: { kind: "string", title: "地址", optional: false, hasDefault: false } } },
};
const snapshot = { schema, effective: { host: "example.com" } };

describe("settingsActivationMessage", () => {
  it("uses schema titles and falls back to paths", () => {
    expect(settingsActivationMessage({
      ...snapshot, activationStatus: "restart_required", restartRequiredPaths: [["host"], ["port"]],
    })).toBe("其余配置已生效。地址、port将在重启服务后生效。");
  });

  it("presents pending, root restart, and failed activation", () => {
    expect(settingsActivationMessage({ ...snapshot, activationStatus: "active" })).toBe("");
    expect(settingsActivationMessage({ ...snapshot, activationStatus: "pending" })).toBe("已保存配置等待服务加载。");
    expect(settingsActivationMessage({
      ...snapshot, activationStatus: "restart_required", restartRequiredPaths: [[]],
    })).toBe("已保存配置将在重启服务后生效。");
    expect(settingsActivationMessage({
      ...snapshot, activationStatus: "apply_failed", activationError: "无法应用配置。",
    })).toBe("无法应用配置。");
  });
});
