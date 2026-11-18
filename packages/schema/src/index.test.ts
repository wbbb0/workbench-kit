// @vitest-environment node
import { describe, expect, it } from "vitest";
import { planSettingsActivation, type ActivationSchema } from "./index.js";

const live = { kind: "string" };
const restart = { kind: "string", activation: "restart" } as const;

function object(fields: Record<string, ActivationSchema>): ActivationSchema {
  return {
    kind: "object",
    fields: Object.fromEntries(Object.entries(fields).map(([key, schema]) => [key, { schema }])),
  };
}

describe("planSettingsActivation", () => {
  it("applies live fields while retaining fields that differ from startup", () => {
    const schema = object({ server: object({ host: restart, label: live }), mode: live });
    const startup = { server: { host: "old", label: "first" }, mode: "one" };
    const published = { server: { host: "new", label: "second" }, mode: "two" };
    expect(planSettingsActivation(schema, startup, published)).toEqual({
      effective: { server: { host: "old", label: "second" }, mode: "two" },
      restartRequiredPaths: [["server", "host"]],
    });
    expect(planSettingsActivation(schema, startup, {
      ...published, server: { ...published.server, host: "old" },
    }).restartRequiredPaths).toEqual([]);
  });

  it("retains missing and removed values at their activation boundary", () => {
    const schema = object({ added: restart, removed: object({ startup: restart }), deleted: live });
    expect(planSettingsActivation<unknown>(schema, { removed: { startup: "old" }, deleted: "old" }, { added: "new" }))
      .toEqual({ effective: { removed: { startup: "old" } }, restartRequiredPaths: [["added"], ["removed"]] });
  });

  it("keeps a collection or union atomic when its schema contains restart fields", () => {
    const schema = object({
      list: { kind: "array", item: restart },
      branch: { kind: "union", options: [object({ name: restart }), live] },
      entries: { kind: "record", recordValue: object({ name: restart, label: live }) },
    });
    const startup = {
      list: ["old"], branch: { name: "old" }, entries: { key: { name: "old", label: "before" } },
    };
    const published = {
      list: ["new"], branch: "new", entries: { key: { name: "new", label: "after" } },
    };
    expect(planSettingsActivation<unknown>(schema, startup, published)).toEqual({
      effective: { ...startup, entries: { key: { name: "old", label: "after" } } },
      restartRequiredPaths: [["list"], ["branch"], ["entries", "key", "name"]],
    });
  });

  it("compares JSON object values independently of property order and preserves own keys", () => {
    const schema = object({ system: { kind: "object", activation: "restart" } });
    const startup = { system: { host: "local", port: 42 } };
    const published = { system: { port: 42, host: "local" }, ["__proto__"]: "data" };
    expect(planSettingsActivation(schema, startup, published)).toEqual({
      effective: published, restartRequiredPaths: [],
    });
  });
});
