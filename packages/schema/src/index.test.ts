// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  applyVariantChange,
  collectSecretPaths,
  defineBoolean,
  defineEnum,
  defineLiteral,
  defineNumber,
  defineObject,
  defineRecord,
  defineString,
  defineUnion,
  defineVariantObject,
  evaluateSchemaPreview,
  formatDurationValue,
  initialValueForSchema,
  isObjectToggleActive,
  planSettingsActivation,
  preserveSecrets,
  redactSecrets,
  renameSchemaReferences,
  resolveObjectFields,
  resolveObjectVariantMeta,
  resolveSchemaBranch,
  schemaAtPath,
  type ActivationSchema,
} from "./index.js";

const live = { kind: "string" };
const restart = { kind: "string", activation: "restart" } as const;

function object(fields: Record<string, ActivationSchema>): ActivationSchema {
  return {
    kind: "object",
    fields: Object.fromEntries(
      Object.entries(fields).map(([key, schema]) => [key, { schema }]),
    ),
  };
}

describe("planSettingsActivation", () => {
  it("applies live fields while retaining fields that differ from startup", () => {
    const schema = object({
      server: object({ host: restart, label: live }),
      mode: live,
    });
    const startup = { server: { host: "old", label: "first" }, mode: "one" };
    const published = { server: { host: "new", label: "second" }, mode: "two" };
    expect(planSettingsActivation(schema, startup, published)).toEqual({
      effective: { server: { host: "old", label: "second" }, mode: "two" },
      restartRequiredPaths: [["server", "host"]],
    });
    expect(
      planSettingsActivation(schema, startup, {
        ...published,
        server: { ...published.server, host: "old" },
      }).restartRequiredPaths,
    ).toEqual([]);
  });

  it("retains missing and removed values at their activation boundary", () => {
    const schema = object({
      added: restart,
      removed: object({ startup: restart }),
      deleted: live,
    });
    expect(
      planSettingsActivation<unknown>(
        schema,
        { removed: { startup: "old" }, deleted: "old" },
        { added: "new" },
      ),
    ).toEqual({
      effective: { removed: { startup: "old" } },
      restartRequiredPaths: [["added"], ["removed"]],
    });
  });

  it("keeps a collection or union atomic when its schema contains restart fields", () => {
    const schema = object({
      list: { kind: "array", item: restart },
      branch: { kind: "union", options: [object({ name: restart }), live] },
      entries: {
        kind: "record",
        recordValue: object({ name: restart, label: live }),
      },
    });
    const startup = {
      list: ["old"],
      branch: { name: "old" },
      entries: { key: { name: "old", label: "before" } },
    };
    const published = {
      list: ["new"],
      branch: "new",
      entries: { key: { name: "new", label: "after" } },
    };
    expect(planSettingsActivation<unknown>(schema, startup, published)).toEqual({
      effective: {
        ...startup,
        entries: { key: { name: "old", label: "after" } },
      },
      restartRequiredPaths: [["list"], ["branch"], ["entries", "key", "name"]],
    });
  });

  it("compares JSON object values independently of property order and preserves own keys", () => {
    const schema = object({ system: { kind: "object", activation: "restart" } });
    const startup = { system: { host: "local", port: 42 } };
    const published = {
      system: { port: 42, host: "local" },
      ["__proto__"]: "data",
    };
    expect(planSettingsActivation(schema, startup, published)).toEqual({
      effective: published,
      restartRequiredPaths: [],
    });
  });

  it("handles toggleField disabled subtrees and variantBy switches", () => {
    const schema: ActivationSchema = object({
      feature: {
        kind: "object",
        toggleField: "enabled",
        fields: {
          enabled: { schema: { kind: "boolean" } },
          port: { schema: restart },
        },
      },
      provider: {
        kind: "object",
        variantBy: "type",
        fields: {
          type: { schema: { kind: "enum" } },
          label: { schema: live },
        },
        variants: {
          a: { fields: { token: { schema: restart } } },
          b: { fields: { endpoint: { schema: live } } },
        },
      },
    });
    const bothOff = planSettingsActivation<unknown>(
      schema,
      { feature: { enabled: false, port: "1" }, provider: { type: "a", token: "x" } },
      { feature: { enabled: false, port: "2" }, provider: { type: "b", endpoint: "y" } },
    );
    expect(bothOff.restartRequiredPaths).toEqual([["provider"]]);
    expect((bothOff.effective as any).feature.port).toBe("2");
    expect((bothOff.effective as any).provider).toEqual({ type: "a", token: "x" });
  });
});

describe("schema helpers, variants, toggle, secrets & preview", () => {
  const proxySchema = defineObject(
    "代理",
    {
      protocol: defineEnum("协议", ["http", "https"] as const, {
        defaultValue: "http",
        hasDefault: true,
      }),
      host: defineString("主机", undefined, { nonempty: true, trim: true }),
      port: defineNumber("端口", 7890, { min: 1, max: 65535, control: "number" }),
      auth: defineObject(
        "认证",
        {
          enabled: defineBoolean("启用认证", false),
          username: defineString("用户名"),
          password: defineString("密码", undefined, { secret: true }),
        },
        {
          toggleField: "enabled",
          preview: (p) => p.ref("username", { fallback: "已认证" }),
        },
      ),
    },
    {
      defaults: false,
      preview: (p) =>
        p.join(
          " · ",
          p.tplAll`${p.ref("protocol")}://${p.ref("host")}:${p.ref("port")}`,
          p.ref("auth"),
        ),
    },
  );

  const providerSchema = defineVariantObject(
    "供应商",
    {
      type: defineEnum("供应商类型", ["openai", "vertex"] as const),
      proxy: defineString("代理", undefined, {
        optional: true,
        reference: { path: ["proxies"], label: "代理" },
      }),
      models: defineRecord(
        "模型",
        defineObject("模型属性", {
          streaming: defineBoolean("流式", true),
        }),
      ),
    },
    {
      variantBy: "type",
      variants: {
        openai: {
          title: "OpenAI",
          fields: {
            apiKey: defineString("密钥", undefined, { secret: true }),
            models: defineRecord(
              "模型",
              defineObject("模型属性", {
                streaming: defineBoolean("流式", true),
                extra: defineBoolean("增量工具", false),
              }),
            ),
          },
          preview: (p) => p.tpl`OpenAI · ${p.ref("models", { format: "count" })} 个模型`,
        },
        vertex: {
          title: "Vertex",
          fields: {
            projectId: defineString("项目 ID"),
          },
          preview: (p) => p.join(" · ", "Vertex", p.ref("projectId")),
        },
      },
    },
  );

  it("evaluates previews safely and excludes secrets or disabled toggle subtrees", () => {
    expect(
      evaluateSchemaPreview(proxySchema, {
        protocol: "http",
        host: "127.0.0.1",
        port: 7890,
        auth: { enabled: false, username: "alice", password: "secret" },
      }),
    ).toBe("http://127.0.0.1:7890");

    expect(
      evaluateSchemaPreview(proxySchema, {
        protocol: "https",
        host: "proxy.local",
        port: 8443,
        auth: { enabled: true, username: "alice", password: "secret" },
      }),
    ).toBe("https://proxy.local:8443 · alice");

    expect(
      evaluateSchemaPreview(proxySchema, {
        protocol: "http",
        host: "",
        port: 7890,
      }),
    ).toBe("");

    expect(
      evaluateSchemaPreview(providerSchema, {
        type: "openai",
        models: { "gpt-5": { streaming: true } },
      }),
    ).toBe("OpenAI · 1 个模型");
  });

  it("handles toggleField default true and override false", () => {
    const schema = defineObject(
      "技能",
      { enabled: defineBoolean("启用", true), limit: defineNumber("上限", 3) },
      { toggleField: "enabled" },
    );
    expect(isObjectToggleActive(schema, {})).toBe(true);
    expect(isObjectToggleActive(schema, { enabled: true }, { enabled: false })).toBe(
      false,
    );
  });

  it("switches variants, prunes overridden fields, and protects cross-variant secrets", () => {
    const switched = applyVariantChange(
      providerSchema,
      {
        type: "openai",
        proxy: "corp",
        apiKey: "sk-123",
        models: { gpt: { streaming: true, extra: true } },
      },
      "vertex",
    );
    expect(switched).toEqual({
      type: "vertex",
      proxy: "corp",
      models: { gpt: { streaming: true } },
    });

    const secrets: Record<string, boolean> = {};
    const redacted = redactSecrets(
      proxySchema,
      { auth: { enabled: false, username: "u", password: "pw" } },
      [],
      secrets,
    ) as any;
    expect(redacted.auth.password).toBeUndefined();
    expect(secrets['["auth","password"]']).toBe(true);

    expect(
      collectSecretPaths(providerSchema, { type: "openai", apiKey: "sk-1" }),
    ).toEqual([["apiKey"]]);

    expect(
      preserveSecrets(
        providerSchema,
        { type: "openai", apiKey: "sk-1" },
        { type: "vertex", projectId: "p1" },
      ),
    ).toEqual({ type: "vertex", projectId: "p1" });

    expect(
      preserveSecrets(
        providerSchema,
        { type: "openai", apiKey: "sk-1" },
        { type: "openai" },
      ),
    ).toEqual({ type: "openai", apiKey: "sk-1" });

    const commonOnly = defineVariantObject(
      "常见策略",
      {
        mode: defineEnum("模式", ["a", "b"] as const),
      },
      {
        variantBy: "mode",
        variants: {
          a: {
            fields: {
              endpoint: defineString("端点"),
              token: defineString("密钥", undefined, { secret: true }),
            },
          },
          b: {
            fields: {
              endpoint: defineString("端点"),
              token: defineString("密钥", undefined, { secret: true }),
            },
          },
        },
      },
    );
    expect(
      applyVariantChange(
        commonOnly,
        { mode: "a", endpoint: "https://a.test", token: "sec-a" },
        "b",
      ),
    ).toEqual({ mode: "b" });

    const matchingSchema = defineVariantObject(
      "计价",
      {
        mode: defineEnum("模式", ["token", "perImage", "tokenAndImage"] as const),
        currency: defineString("币种"),
      },
      {
        variantBy: "mode",
        variantPreserve: "matching",
        variants: {
          token: {
            fields: {
              inputPerMillion: defineNumber("输入", 0),
              outputPerMillion: defineNumber("输出", 0),
              secretNote: defineString("密钥", undefined, { secret: true }),
            },
          },
          perImage: {
            fields: {
              outputPerImage: defineNumber("每张", 0),
            },
          },
          tokenAndImage: {
            fields: {
              inputPerMillion: defineNumber("输入", 0),
              outputPerMillion: defineNumber("输出", 0),
              outputPerImage: defineNumber("每张", 0),
              secretNote: defineString("密钥", undefined, { secret: true }),
            },
          },
        },
      },
    );
    expect(
      applyVariantChange(
        matchingSchema,
        {
          mode: "token",
          currency: "USD",
          inputPerMillion: 0,
          outputPerMillion: 2,
          secretNote: "secret-1",
        },
        "tokenAndImage",
      ),
    ).toEqual({
      mode: "tokenAndImage",
      currency: "USD",
      inputPerMillion: 0,
      outputPerMillion: 2,
    });
    expect(
      applyVariantChange(
        matchingSchema,
        {
          mode: "tokenAndImage",
          currency: "USD",
          inputPerMillion: 0,
          outputPerMillion: 2,
          outputPerImage: 0.04,
        },
        "perImage",
      ),
    ).toEqual({
      mode: "perImage",
      currency: "USD",
      outputPerImage: 0.04,
    });
  });

  it("resolves schemaAtPath, initialValue, references, and duration formatting", () => {
    expect(
      schemaAtPath(providerSchema, { type: "openai" }, ["models", "gpt", "extra"])
        ?.kind,
    ).toBe("boolean");
    expect(resolveObjectFields(providerSchema, { type: "vertex" }).apiKey).toBeUndefined();
    expect(initialValueForSchema(providerSchema)).toEqual({
      type: "openai",
    });
    expect(
      renameSchemaReferences(
        providerSchema,
        { type: "vertex", proxy: "old-proxy" },
        ["proxies"],
        "old-proxy",
        "new-proxy",
      ),
    ).toEqual({ type: "vertex", proxy: "new-proxy" });
    expect(formatDurationValue(30000, "s")).toBe("30秒");
    expect(formatDurationValue(86400000, "h")).toBe("24小时");
    expect(resolveObjectVariantMeta(providerSchema, { type: "vertex" })?.currentKey).toBe(
      "vertex",
    );

    const unionSchema = defineUnion(
      "分支",
      [
        defineObject("A", { kind: defineLiteral("a") }),
        defineObject("无判别", { label: defineString("名") }),
      ],
      { discriminator: "type" },
    );
    expect(resolveSchemaBranch(unionSchema, {})).toBe(unionSchema);
    expect(resolveSchemaBranch(unionSchema, { type: undefined })).toBe(unionSchema);

    const refVariantSchema = defineVariantObject(
      "引用测试",
      {
        mode: defineEnum("模式", ["one", "two"] as const),
      },
      {
        variantBy: "mode",
        variants: {
          one: {
            fields: {
              target: defineString("引用", undefined, {
                reference: { path: ["targets"], label: "目标" },
              }),
            },
          },
          two: {
            fields: {
              target: defineString("普通文本"),
            },
          },
        },
      },
    );
    expect(
      renameSchemaReferences(
        refVariantSchema,
        { mode: "one", target: "old" },
        ["targets"],
        "old",
        "renamed",
      ),
    ).toEqual({ mode: "one", target: "renamed" });
    expect(
      renameSchemaReferences(
        refVariantSchema,
        { mode: "two", target: "old" },
        ["targets"],
        "old",
        "renamed",
      ),
    ).toEqual({ mode: "two", target: "old" });
  });
});
